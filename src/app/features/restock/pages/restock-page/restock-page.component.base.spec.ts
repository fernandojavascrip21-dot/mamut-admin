import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { API_BASE_URL } from '@core/api-base-url';
import { ConfirmService } from '@core/confirm/confirm.service';
import { ToastService } from '@core/toast/toast.service';
import type { RestockOrder, RestockProduct, RestockSuggestion } from '../../interfaces/restock.models';
import { RestockExportService } from '../../services/restock-export.service';
import { RestockPageComponent } from './restock-page.component';

const ORDERS = `${API_BASE_URL}/api/restock/orders`;
const DRAFTS = `${ORDERS}?status=draft`;
const SUGGESTIONS_URL = `${API_BASE_URL}/api/restock/suggestions`;
const PRODUCTS_URL = `${API_BASE_URL}/api/restock/products`;
const BASE_URL = `${ORDERS}/4`;

const PRODUCTS: RestockProduct[] = [
  { productId: 1, name: 'Creatina 300 g', image: null, units: 0, stockLevel: 'out', unitCost: '12.5000' },
  { productId: 2, name: 'Proteína 2 kg', image: null, units: 2, stockLevel: 'low', unitCost: '10.0000' },
];
const SUGGESTIONS: RestockSuggestion[] = [
  { productId: 2, name: 'Proteína 2 kg', image: null, units: 2, stockLevel: 'low', unitCost: '10.0000' },
];
const DRAFT: RestockOrder = {
  id: 7, status: 'draft', note: 'Nota del borrador', createdAt: '2026-11-09T18:00:00Z', updatedAt: '2026-11-10T01:00:00Z',
  closedAt: null, lineCount: 1, totalUnits: 1, estimatedTotal: '10.00', requestId: 'r-draft',
  lines: [{ product: { id: 2, name: 'Proteína 2 kg', image: null }, qty: 1, unitCost: '10.0000' }],
  customLines: [],
};
// Pedido base: un producto vigente, dos que ya no se pueden pedir y dos escritos a mano.
const BASE: RestockOrder = {
  id: 4, status: 'closed', note: 'Nota del pedido viejo', createdAt: '2026-10-18T18:00:00Z',
  updatedAt: '2026-10-20T18:00:00Z', closedAt: '2026-10-20T18:00:00Z', lineCount: 5, totalUnits: 14,
  estimatedTotal: '100.00', requestId: 'r-4',
  lines: [
    { product: { id: 1, name: 'Creatina 300 g', image: null }, qty: 5, unitCost: '9.0000' },
    { product: { id: 9, name: 'Producto desactivado', image: null }, qty: 3, unitCost: '4.0000' },
    { product: { id: 10, name: 'Bolsita', image: null }, qty: 3, unitCost: '1.0000' },
  ],
  customLines: [
    { id: 1, name: 'Shaker', qty: 2, unitCost: '15.0000' },
    { id: 2, name: 'Bolsas', qty: 1, unitCost: null },
  ],
};
const SAVED: RestockOrder = { ...BASE, id: 8, status: 'draft', closedAt: null, requestId: 'x', note: null };
const error = (status: number, message: string) =>
  [{ error: { code: 'x', message } }, { status, statusText: 'Error' }] as const;

describe('RestockPageComponent · usar un pedido como base (HU-32)', () => {
  let fixture: ComponentFixture<RestockPageComponent>;
  let httpMock: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let confirm: { ask: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.spyOn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  const root = () => document.body;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const button = (label: string) =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.trim() === label)!;
  const click = async (label: string) => {
    button(label).click();
    await settle();
  };
  const values = (selector: string) =>
    Array.from(root().querySelectorAll<HTMLInputElement>(selector)).map((input) => input.value);
  // El parámetro se quita con una navegación que reemplaza la URL, sea por navigate o por navigateByUrl.
  const replaceNavigations = () =>
    [...navigate.mock.calls, ...navigateByUrl.mock.calls].filter(
      (call) => (call[1] as { replaceUrl?: boolean } | undefined)?.replaceUrl === true,
    );

  const setup = async (base: string | null = '4') => {
    toast = { success: vi.fn(), error: vi.fn() };
    confirm = { ask: vi.fn().mockResolvedValue(true) };
    const params = convertToParamMap(base ? { base } : {});
    await TestBed.configureTestingModule({
      imports: [RestockPageComponent],
      providers: [
        MessageService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: params }, paramMap: of(params) } },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: confirm },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(RestockPageComponent);
    fixture.detectChanges();
  };
  // Atiende las cargas de la pantalla y la del pedido base (que puede fallar o traer otro pedido).
  const flushLoad = async (
    opts: { draft?: RestockOrder | null; base?: { order: RestockOrder } | { status: number; message: string } } = {},
  ) => {
    const draft = opts.draft ?? null;
    httpMock.expectOne(SUGGESTIONS_URL).flush({ suggestions: SUGGESTIONS });
    httpMock.expectOne(PRODUCTS_URL).flush({ products: PRODUCTS });
    httpMock.expectOne(DRAFTS).flush({ orders: draft ? [{ ...draft, lines: undefined, customLines: undefined }] : [] });
    if (draft) httpMock.expectOne(`${ORDERS}/${draft.id}`).flush({ order: draft });
    const base = opts.base ?? { order: BASE };
    if ('order' in base) httpMock.expectOne(BASE_URL).flush({ order: base.order });
    else httpMock.expectOne(BASE_URL).flush(...error(base.status, base.message));
    await settle();
  };
  const load = async (opts: Parameters<typeof flushLoad>[0] = {}) => {
    await setup();
    fixture.detectChanges();
    await flushLoad(opts);
  };

  afterEach(() => httpMock.verify());

  it('sin el parámetro base no pide ningún pedido base', async () => {
    await setup(null);
    fixture.detectChanges();
    httpMock.expectOne(SUGGESTIONS_URL).flush({ suggestions: SUGGESTIONS });
    httpMock.expectOne(PRODUCTS_URL).flush({ products: PRODUCTS });
    httpMock.expectOne(DRAFTS).flush({ orders: [] });
    await settle();
    expect(httpMock.match(BASE_URL)).toHaveLength(0);
    expect(text()).toContain('Pedido nuevo');
  });

  describe('sin borrador', () => {
    it('el encabezado dice «Pedido nuevo · basado en el pedido del <closedAt>»', async () => {
      await load();
      expect(text()).toContain('Pedido nuevo · basado en el pedido del 20 oct 2026');
    });

    it('los renglones del base sustituyen a las sugerencias: catálogo vigente primero y luego los escritos', async () => {
      await load();
      expect(values('input.restock-qty')).toEqual(['5', '2', '1']);
      expect(text()).not.toContain('Proteína 2 kg');
    });

    it('el catálogo toma el costo de fábrica actual y los escritos conservan el guardado (o vacío)', async () => {
      await load();
      expect(values('input.restock-cost')).toEqual(['12.5000', '15.0000', '']);
    });

    it('la nota del pedido viejo no se copia', async () => {
      await load();
      expect(root().querySelector<HTMLTextAreaElement>('.restock-note')!.value).toBe('');
      expect(text()).not.toContain('Nota del pedido viejo');
    });

    it('queda con cambios sin guardar, para que salir pregunte', async () => {
      await load();
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
    });

    it('no pregunta nada: no hay borrador que reemplazar', async () => {
      await load();
      expect(confirm.ask).not.toHaveBeenCalled();
    });

    it('«Guardar pedido» manda un POST de pedido nuevo con una llave nueva y los renglones copiados', async () => {
      await load();
      await click('Guardar pedido');
      const req = httpMock.expectOne(ORDERS);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        requestId: expect.any(String),
        note: null,
        lines: [
          { productId: 1, qty: 5, unitCost: '12.5000' },
          { name: 'Shaker', qty: 2, unitCost: '15.0000' },
          { name: 'Bolsas', qty: 1, unitCost: null },
        ],
      });
      expect(req.request.body.requestId).not.toBe(BASE.requestId);
      req.flush({ order: SAVED, replayed: false }, { status: 201, statusText: 'Created' });
      await settle();
    });
  });

  describe('omitidos', () => {
    it('avisa «2 productos del pedido base ya no se pueden pedir y no se agregaron.» y no los copia', async () => {
      await load();
      expect(text()).toContain('2 productos del pedido base ya no se pueden pedir y no se agregaron.');
      expect(root().querySelector('.alert-warning')).not.toBeNull();
      expect(text()).not.toContain('Producto desactivado');
    });

    it('si no se omite ninguno no hay aviso', async () => {
      await load({ base: { order: { ...BASE, lines: [BASE.lines[0]] } } });
      expect(text()).not.toContain('ya no se pueden pedir');
    });

    it('el aviso se queda hasta el siguiente guardado', async () => {
      await load();
      await click('Guardar pedido');
      httpMock.expectOne(ORDERS).flush({ order: SAVED, replayed: false }, { status: 201, statusText: 'Created' });
      await settle();
      expect(text()).not.toContain('ya no se pueden pedir');
    });
  });

  describe('con borrador', () => {
    it('antes de tocar nada pide confirmación con «Reemplazar» y «Cancelar»', async () => {
      let answer: (accepted: boolean) => void = () => undefined;
      await setup();
      confirm.ask.mockReturnValue(new Promise<boolean>((resolve) => (answer = resolve)));
      fixture.detectChanges();
      await flushLoad({ draft: DRAFT });
      expect(confirm.ask).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '¿Reemplazar los productos de tu borrador con los de este pedido? Se guardan cuando pulses «Guardar pedido».',
          confirmLabel: 'Reemplazar',
          cancelLabel: 'Cancelar',
        }),
      );
      expect(values('input.restock-qty')).toEqual(['1']);
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
      answer(false);
      await settle();
    });

    it('«Reemplazar» cambia los renglones, conserva la nota del borrador y deja cambios sin guardar', async () => {
      await load({ draft: DRAFT });
      expect(values('input.restock-qty')).toEqual(['5', '2', '1']);
      expect(root().querySelector<HTMLTextAreaElement>('.restock-note')!.value).toBe('Nota del borrador');
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
    });

    it('«Guardar pedido» después de reemplazar manda un PUT del mismo borrador', async () => {
      await load({ draft: DRAFT });
      await click('Guardar pedido');
      const req = httpMock.expectOne(`${ORDERS}/7`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.note).toBe('Nota del borrador');
      expect(req.request.body.lines).toHaveLength(3);
      req.flush({ order: { ...SAVED, id: 7 } });
      await settle();
    });

    it('«Cancelar» deja el borrador como estaba y quita el parámetro base', async () => {
      await setup();
      confirm.ask.mockResolvedValue(false);
      fixture.detectChanges();
      await flushLoad({ draft: DRAFT });
      expect(values('input.restock-qty')).toEqual(['1']);
      expect(root().querySelector<HTMLTextAreaElement>('.restock-note')!.value).toBe('Nota del borrador');
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
      expect(replaceNavigations().length).toBeGreaterThan(0);
    });
  });

  describe('el pedido base no sirve', () => {
    it('con 404 avisa «No encontramos ese pedido» y carga las sugerencias como siempre', async () => {
      await load({ base: { status: 404, message: 'No existe' } });
      expect(toast.error).toHaveBeenCalledWith('No encontramos ese pedido');
      expect(text()).toContain('Pedido nuevo');
      expect(text()).toContain('Proteína 2 kg');
      expect(text()).not.toContain('basado en el pedido');
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });

    it('si el base es un borrador avisa lo mismo y carga normal', async () => {
      await load({ base: { order: { ...BASE, status: 'draft', closedAt: null } } });
      expect(toast.error).toHaveBeenCalledWith('No encontramos ese pedido');
      expect(text()).toContain('Proteína 2 kg');
    });

    it('con 404 y borrador carga el borrador sin preguntar', async () => {
      await load({ draft: DRAFT, base: { status: 404, message: 'No existe' } });
      expect(confirm.ask).not.toHaveBeenCalled();
      expect(values('input.restock-qty')).toEqual(['1']);
    });

    it('con otro error muestra el estado de error del pop-up con «Reintentar»', async () => {
      await load({ base: { status: 500, message: 'x' } });
      expect(text()).toContain('No pudimos cargar la lista de resurtir');
      expect(button('Reintentar')).toBeDefined();
    });
  });

  describe('el parámetro se consume una sola vez', () => {
    it('quita el parámetro base con una navegación que reemplaza la URL', async () => {
      await load();
      expect(replaceNavigations()).toHaveLength(1);
    });

    it('tras guardar y cerrar, la recarga no vuelve a pedir ni a aplicar el base', async () => {
      await load();
      await click('Guardar pedido');
      httpMock.expectOne(ORDERS).flush({ order: SAVED, replayed: false }, { status: 201, statusText: 'Created' });
      await settle();
      await click('Cerrar pedido');
      httpMock.expectOne(`${ORDERS}/8/close`).flush({ order: { ...SAVED, status: 'closed' } });
      await settle();
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      httpMock.expectOne(SUGGESTIONS_URL).flush({ suggestions: SUGGESTIONS });
      httpMock.expectOne(PRODUCTS_URL).flush({ products: PRODUCTS });
      httpMock.expectOne(DRAFTS).flush({ orders: [] });
      await settle();
      expect(httpMock.match(BASE_URL)).toHaveLength(0);
      expect(values('input.restock-qty')).toEqual(['']);
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });
  });
});
