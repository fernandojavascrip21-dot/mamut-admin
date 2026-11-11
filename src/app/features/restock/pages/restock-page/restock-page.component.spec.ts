import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { API_BASE_URL } from '@core/api-base-url';
import { ConfirmService } from '@core/confirm/confirm.service';
import { ToastService } from '@core/toast/toast.service';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { closeModalLink } from '@shared/utils/modal-links';
import type { RestockOrder, RestockProduct, RestockSuggestion } from '../../interfaces/restock.models';
import { RestockPageComponent } from './restock-page.component';

const ORDERS = `${API_BASE_URL}/api/restock/orders`;
const DRAFTS = `${ORDERS}?status=draft`;
const SUGGESTIONS_URL = `${API_BASE_URL}/api/restock/suggestions`;
const PRODUCTS_URL = `${API_BASE_URL}/api/restock/products`;

const PRODUCTS: RestockProduct[] = [
  { productId: 1, name: 'Creatina 300 g', image: null, units: 0, stockLevel: 'out', unitCost: '12.5000' },
  { productId: 2, name: 'Proteína 2 kg', image: null, units: 2, stockLevel: 'low', unitCost: '10.0000' },
  { productId: 3, name: 'Barra de avena', image: null, units: 40, stockLevel: 'ok', unitCost: '1.0000' },
];
const SUGGESTIONS: RestockSuggestion[] = [
  { productId: 1, name: 'Creatina 300 g', image: null, units: 0, stockLevel: 'out', unitCost: '12.5000' },
];
const DRAFT: RestockOrder = {
  id: 7, status: 'draft', note: 'Nota guardada', createdAt: '2026-11-09T18:00:00Z', updatedAt: '2026-11-10T01:00:00Z',
  closedAt: null, lineCount: 2, totalUnits: 3, estimatedTotal: '31.00', requestId: 'r-draft',
  lines: [
    { product: { id: 1, name: 'Creatina 300 g', image: null }, qty: 2, unitCost: '10.5000' },
    { product: { id: 2, name: 'Proteína 2 kg', image: null }, qty: 1, unitCost: '10.0000' },
  ],
  customLines: [],
};
const NEW_ORDER: RestockOrder = {
  ...DRAFT, id: 8, requestId: 'x', note: null, lineCount: 1, totalUnits: 2, estimatedTotal: '25.00',
  lines: [{ product: { id: 1, name: 'Creatina 300 g', image: null }, qty: 2, unitCost: '12.5000' }],
};
const error = (status: number, message: string) =>
  [{ error: { code: 'x', message } }, { status, statusText: 'Error' }] as const;

describe('RestockPageComponent', () => {
  let fixture: ComponentFixture<RestockPageComponent>;
  let httpMock: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let confirm: { ask: ReturnType<typeof vi.fn> };

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
  const typeQty = async (index: number, value: string) => {
    const input = root().querySelectorAll<HTMLInputElement>('input.restock-qty')[index]!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };

  const setup = async () => {
    toast = { success: vi.fn(), error: vi.fn() };
    confirm = { ask: vi.fn().mockResolvedValue(true) };
    await TestBed.configureTestingModule({
      imports: [RestockPageComponent],
      providers: [
        MessageService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: confirm },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RestockPageComponent);
  };
  // Atiende las tres cargas de la pantalla (y el detalle si hay borrador).
  const flushLoad = async (
    opts: { draft?: RestockOrder | null; suggestions?: RestockSuggestion[]; products?: RestockProduct[] } = {},
  ) => {
    const draft = opts.draft ?? null;
    httpMock.expectOne(SUGGESTIONS_URL).flush({ suggestions: opts.suggestions ?? SUGGESTIONS });
    httpMock.expectOne(PRODUCTS_URL).flush({ products: opts.products ?? PRODUCTS });
    httpMock.expectOne(DRAFTS).flush({ orders: draft ? [{ ...draft, lines: undefined, customLines: undefined }] : [] });
    if (draft) httpMock.expectOne(`${ORDERS}/${draft.id}`).flush({ order: draft });
    await settle();
  };
  const load = async (opts: Parameters<typeof flushLoad>[0] = {}) => {
    await setup();
    fixture.detectChanges();
    await flushLoad(opts);
  };
  const created = (req: TestRequest, order: RestockOrder = NEW_ORDER, replayed = false) =>
    req.flush({ order, replayed }, { status: replayed ? 200 : 201, statusText: 'OK' });

  afterEach(() => httpMock.verify());

  describe('pop-up', () => {
    it('se pinta dentro de un modal-panel con el título «Lista de resurtir»', async () => {
      await load();
      const panel = fixture.debugElement.query(By.directive(ModalPanelComponent));
      expect(panel).not.toBeNull();
      expect(panel.componentInstance.title()).toBe('Lista de resurtir');
    });

    it('cerrar el pop-up cierra la ventana y vuelve a «Stock general»', async () => {
      await load();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      fixture.debugElement.query(By.directive(ModalPanelComponent)).componentInstance.closed.emit();
      expect(navigate).toHaveBeenCalledWith(closeModalLink());
    });
  });

  describe('estados', () => {
    it('mientras carga muestra «Lista de resurtir» y un esqueleto de 3 renglones', async () => {
      await setup();
      fixture.detectChanges();
      expect(text()).toContain('Lista de resurtir');
      expect(root().querySelectorAll('p-skeleton').length).toBeGreaterThanOrEqual(3);
      await flushLoad();
    });

    it('si la carga falla muestra el error y «Reintentar» vuelve a pedir todo', async () => {
      await setup();
      fixture.detectChanges();
      httpMock.expectOne(SUGGESTIONS_URL).flush(...error(500, 'x'));
      httpMock.match(PRODUCTS_URL);
      httpMock.match(DRAFTS);
      await settle();
      expect(text()).toContain('No pudimos cargar la lista de resurtir');
      button('Reintentar').click();
      fixture.detectChanges();
      await flushLoad();
      expect(text()).not.toContain('No pudimos cargar la lista de resurtir');
    });

    it('sin borrador ni sugerencias muestra «Nada que resurtir» y deja armar un pedido a mano', async () => {
      await load({ suggestions: [] });
      expect(text()).toContain('Nada que resurtir');
      expect(text()).toContain('Todos los productos tienen piezas en bodega.');
      expect(text()).toContain('Agregar producto');
      expect(button('Escribir un producto')).toBeDefined();
    });
  });

  describe('pedido nuevo y borrador', () => {
    it('sin borrador dice «Pedido nuevo», parte de las sugerencias con piezas vacías y no ofrece descartar', async () => {
      await load();
      expect(text()).toContain('Pedido nuevo');
      expect(root().querySelectorAll('app-restock-line')).toHaveLength(1);
      expect(root().querySelector<HTMLInputElement>('input.restock-qty')!.value).toBe('');
      expect(root().querySelector<HTMLInputElement>('input.restock-cost')!.value).toBe('12.5000');
      expect(text()).not.toContain('Descartar borrador');
    });

    it('con borrador dice «Borrador del …» y «Guardado …», pinta sus renglones, la nota y «Descartar borrador»', async () => {
      await load({ draft: DRAFT });
      expect(text()).toContain('Borrador del');
      expect(text()).toContain('Guardado');
      expect(text()).not.toContain('Pedido nuevo');
      const qtys = Array.from(root().querySelectorAll<HTMLInputElement>('input.restock-qty')).map((i) => i.value);
      expect(qtys).toEqual(['2', '1']);
      expect(root().querySelector<HTMLTextAreaElement>('.restock-note')!.value).toBe('Nota guardada');
      expect(text()).toContain('$31.00');
      expect(text()).toContain('Descartar borrador');
    });

    it('al entrar no hay cambios sin guardar ni envío en curso', async () => {
      await load();
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
      expect(fixture.componentInstance.saving()).toBe(false);
    });

    it('al escribir hay cambios sin guardar', async () => {
      await load();
      await typeQty(0, '3');
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
    });
  });

  describe('guardar', () => {
    it('sin borrador manda POST con { requestId, note, lines }, avisa y deja la lista sin cambios', async () => {
      await load();
      await typeQty(0, '2');
      await click('Guardar pedido');
      const req = httpMock.expectOne(ORDERS);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        requestId: expect.any(String), note: null, lines: [{ productId: 1, qty: 2, unitCost: '12.5000' }],
      });
      created(req);
      await settle();
      expect(toast.success).toHaveBeenCalledWith('Pedido guardado');
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
      expect(text()).toContain('Guardado');
    });

    it('después de guardar el siguiente guardado es un PUT al borrador', async () => {
      await load();
      await typeQty(0, '2');
      await click('Guardar pedido');
      created(httpMock.expectOne(ORDERS));
      await settle();
      await typeQty(0, '5');
      await click('Guardar pedido');
      const req = httpMock.expectOne(`${ORDERS}/8`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ note: null, lines: [{ productId: 1, qty: 5, unitCost: '12.5000' }] });
      req.flush({ order: NEW_ORDER });
      await settle();
      expect(toast.success).toHaveBeenCalledTimes(2);
    });

    it('con borrador guardar manda PUT con { note, lines }', async () => {
      await load({ draft: DRAFT });
      await typeQty(0, '4');
      await click('Guardar pedido');
      const req = httpMock.expectOne(`${ORDERS}/7`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        note: 'Nota guardada',
        lines: [{ productId: 1, qty: 4, unitCost: '10.5000' }, { productId: 2, qty: 1, unitCost: '10.0000' }],
      });
      req.flush({ order: DRAFT });
      await settle();
    });

    it('inválido no manda nada y pinta los errores', async () => {
      await load();
      await click('Guardar pedido');
      httpMock.expectNone(ORDERS);
      expect(text()).toContain('Escribe cuántas piezas');
    });

    it('sin conexión muestra el aviso y «Reintentar» reenvía con el mismo requestId', async () => {
      await load();
      await typeQty(0, '2');
      await click('Guardar pedido');
      const first = httpMock.expectOne(ORDERS);
      const requestId = first.request.body.requestId as string;
      first.error(new ProgressEvent('error'));
      await settle();
      expect(text()).toContain('No pudimos guardar el pedido. Inténtalo de nuevo.');
      expect(toast.success).not.toHaveBeenCalled();
      expect(root().querySelector<HTMLInputElement>('input.restock-qty')!.value).toBe('2');
      await click('Reintentar');
      const retry = httpMock.expectOne(ORDERS);
      expect(retry.request.body.requestId).toBe(requestId);
      created(retry);
      await settle();
      expect(toast.success).toHaveBeenCalledWith('Pedido guardado');
    });

    it('un 5xx también cuenta como falta de conexión', async () => {
      await load();
      await typeQty(0, '2');
      await click('Guardar pedido');
      httpMock.expectOne(ORDERS).flush(...error(503, 'x'));
      await settle();
      expect(text()).toContain('No pudimos guardar el pedido. Inténtalo de nuevo.');
    });

    it('un 422 muestra el mensaje del backend en un alert-danger', async () => {
      await load();
      await typeQty(0, '2');
      await click('Guardar pedido');
      httpMock.expectOne(ORDERS).flush(...error(422, 'Un producto escrito aparece dos veces en el pedido'));
      await settle();
      expect(root().querySelector('.alert-danger')!.textContent).toContain(
        'Un producto escrito aparece dos veces en el pedido',
      );
    });

    it('un 409 «Este pedido ya está cerrado.» ofrece «Volver a cargar», que recarga todo', async () => {
      await load({ draft: DRAFT });
      await typeQty(0, '4');
      await click('Guardar pedido');
      httpMock.expectOne(`${ORDERS}/7`).flush(...error(409, 'Este pedido ya está cerrado.'));
      await settle();
      expect(text()).toContain('Este pedido ya está cerrado.');
      button('Volver a cargar').click();
      fixture.detectChanges();
      await flushLoad();
    });

    it('un 404 muestra el mensaje del backend', async () => {
      await load({ draft: DRAFT });
      await typeQty(0, '4');
      await click('Guardar pedido');
      httpMock.expectOne(`${ORDERS}/7`).flush(...error(404, 'Producto no encontrado'));
      await settle();
      expect(text()).toContain('Producto no encontrado');
    });
  });

  describe('un solo envío', () => {
    it('mientras guarda los botones quedan deshabilitados y un segundo clic no manda otra petición', async () => {
      await load({ draft: DRAFT });
      await typeQty(0, '4');
      await click('Guardar pedido');
      const req = httpMock.expectOne(`${ORDERS}/7`);
      expect(fixture.componentInstance.saving()).toBe(true);
      for (const label of ['Guardar pedido', 'Cerrar pedido', 'Descartar borrador']) {
        expect(button(label).disabled).toBe(true);
      }
      button('Guardar pedido').click();
      await settle();
      httpMock.expectNone(`${ORDERS}/7`);
      req.flush({ order: DRAFT });
      await settle();
      expect(fixture.componentInstance.saving()).toBe(false);
    });
  });

  describe('cerrar pedido', () => {
    it('con lista vacía no manda nada y avisa que falta un producto', async () => {
      await load({ suggestions: [] });
      await click('Cerrar pedido');
      expect(text()).toContain('Agrega al menos un producto para cerrar el pedido');
      expect(confirm.ask).not.toHaveBeenCalled();
    });

    it('confirma con el total y N productos, y sin cambios manda solo el close', async () => {
      await load({ draft: DRAFT });
      await click('Cerrar pedido');
      expect(confirm.ask).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '¿Cerrar el pedido con 2 productos (total estimado $31.00)? Ya no se podrá editar.',
          confirmLabel: 'Cerrar pedido',
          cancelLabel: 'Cancelar',
        }),
      );
      httpMock.expectNone(`${ORDERS}/7`);
      const close = httpMock.expectOne(`${ORDERS}/7/close`);
      expect(close.request.method).toBe('POST');
      close.flush({ order: { ...DRAFT, status: 'closed' } });
      await settle();
      expect(toast.success).toHaveBeenCalledWith('Pedido cerrado');
      await flushLoad();
    });

    it('con cambios sin guardar manda primero el PUT y después el close', async () => {
      await load({ draft: DRAFT });
      await typeQty(0, '4');
      await click('Cerrar pedido');
      const put = httpMock.expectOne(`${ORDERS}/7`);
      expect(put.request.method).toBe('PUT');
      httpMock.expectNone(`${ORDERS}/7/close`);
      put.flush({ order: DRAFT });
      await settle();
      httpMock.expectOne(`${ORDERS}/7/close`).flush({ order: { ...DRAFT, status: 'closed' } });
      await settle();
      expect(toast.success).toHaveBeenCalledWith('Pedido cerrado');
      await flushLoad({ suggestions: [] });
    });

    it('con un pedido nuevo manda POST y después el close del pedido creado', async () => {
      await load();
      await typeQty(0, '2');
      await click('Cerrar pedido');
      created(httpMock.expectOne(ORDERS));
      await settle();
      httpMock.expectOne(`${ORDERS}/8/close`).flush({ order: { ...NEW_ORDER, status: 'closed' } });
      await settle();
      await flushLoad();
      expect(text()).toContain('Pedido nuevo');
    });

    it('al cancelar la confirmación no manda nada', async () => {
      await load({ draft: DRAFT });
      confirm.ask.mockResolvedValue(false);
      await click('Cerrar pedido');
      httpMock.expectNone(`${ORDERS}/7/close`);
      httpMock.expectNone(`${ORDERS}/7`);
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('si el guardado sale bien y el cierre falla, muestra el error y sigue sobre el mismo borrador', async () => {
      await load();
      await typeQty(0, '2');
      await click('Cerrar pedido');
      created(httpMock.expectOne(ORDERS));
      await settle();
      httpMock.expectOne(`${ORDERS}/8/close`).flush(...error(422, 'No se puede cerrar un pedido sin productos'));
      await settle();
      expect(text()).toContain('No se puede cerrar un pedido sin productos');
      await click('Guardar pedido');
      expect(httpMock.expectOne(`${ORDERS}/8`).request.method).toBe('PUT');
      httpMock.expectNone(ORDERS);
    });
  });

  describe('descartar borrador', () => {
    it('pide confirmación, manda DELETE, avisa y vuelve a cargar partiendo de las sugerencias', async () => {
      await load({ draft: DRAFT });
      await click('Descartar borrador');
      expect(confirm.ask).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '¿Descartar el borrador? Se borra lo que guardaste.',
          confirmLabel: 'Descartar',
          tone: 'danger',
        }),
      );
      const req = httpMock.expectOne(`${ORDERS}/7`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
      await settle();
      expect(toast.success).toHaveBeenCalledWith('Borrador descartado');
      await flushLoad();
      expect(text()).toContain('Pedido nuevo');
    });

    it('un 404 se trata como descartado', async () => {
      await load({ draft: DRAFT });
      await click('Descartar borrador');
      httpMock.expectOne(`${ORDERS}/7`).flush(...error(404, 'No encontrado'));
      await settle();
      expect(toast.success).toHaveBeenCalledWith('Borrador descartado');
      await flushLoad();
    });

    it('al cancelar no manda nada', async () => {
      await load({ draft: DRAFT });
      confirm.ask.mockResolvedValue(false);
      await click('Descartar borrador');
      httpMock.expectNone(`${ORDERS}/7`);
      expect(toast.success).not.toHaveBeenCalled();
    });
  });
});
