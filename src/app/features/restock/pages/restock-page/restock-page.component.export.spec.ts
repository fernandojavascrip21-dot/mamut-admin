import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { API_BASE_URL } from '@core/api-base-url';
import { ConfirmService } from '@core/confirm/confirm.service';
import { ToastService } from '@core/toast/toast.service';
import { restockHistoryModalLink } from '@shared/utils/modal-links';
import type { RestockOrder, RestockProduct, RestockSuggestion } from '../../interfaces/restock.models';
import { buildExportDocument } from '../../rules/restock-export.rules';
import { RestockExportService } from '../../services/restock-export.service';
import { RestockPageComponent } from './restock-page.component';

const ORDERS = `${API_BASE_URL}/api/restock/orders`;
const DRAFTS = `${ORDERS}?status=draft`;
const SUGGESTIONS_URL = `${API_BASE_URL}/api/restock/suggestions`;
const PRODUCTS_URL = `${API_BASE_URL}/api/restock/products`;

const PRODUCTS: RestockProduct[] = [
  { productId: 1, name: 'Creatina 300 g', image: null, units: 0, stockLevel: 'out', unitCost: '12.5000' },
];
const SUGGESTIONS: RestockSuggestion[] = [
  { productId: 1, name: 'Creatina 300 g', image: null, units: 0, stockLevel: 'out', unitCost: '12.5000' },
];
const DRAFT: RestockOrder = {
  id: 7, status: 'draft', note: 'Nota guardada', createdAt: '2026-11-09T18:00:00Z', updatedAt: '2026-11-10T01:00:00Z',
  closedAt: null, lineCount: 1, totalUnits: 2, estimatedTotal: '25.00', requestId: 'r-draft',
  lines: [{ product: { id: 1, name: 'Creatina 300 g', image: null }, qty: 2, unitCost: '12.5000' }],
  customLines: [],
};
const HELP = 'Guarda el pedido para exportarlo';

describe('RestockPageComponent · pedidos anteriores y exportar (HU-32)', () => {
  let fixture: ComponentFixture<RestockPageComponent>;
  let httpMock: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let exporter: { download: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.spyOn>;

  const root = () => document.body;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const buttons = (label: string) =>
    Array.from(root().querySelectorAll('button')).filter((b) => b.textContent!.trim().includes(label));
  const button = (label: string) => buttons(label)[0]!;
  const click = async (label: string) => {
    button(label).click();
    await settle();
  };
  const typeQty = async (value: string) => {
    const input = root().querySelector<HTMLInputElement>('input.restock-qty')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };

  const setup = async () => {
    toast = { success: vi.fn(), error: vi.fn() };
    exporter = { download: vi.fn().mockResolvedValue(undefined) };
    await TestBed.configureTestingModule({
      imports: [RestockPageComponent],
      providers: [
        MessageService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: { ask: vi.fn().mockResolvedValue(true) } },
        { provide: RestockExportService, useValue: exporter },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(RestockPageComponent);
    fixture.detectChanges();
  };
  const load = async (draft: RestockOrder | null) => {
    await setup();
    httpMock.expectOne(SUGGESTIONS_URL).flush({ suggestions: SUGGESTIONS });
    httpMock.expectOne(PRODUCTS_URL).flush({ products: PRODUCTS });
    httpMock.expectOne(DRAFTS).flush({ orders: draft ? [{ ...draft, lines: undefined, customLines: undefined }] : [] });
    if (draft) httpMock.expectOne(`${ORDERS}/${draft.id}`).flush({ order: draft });
    await settle();
  };

  afterEach(() => httpMock.verify());

  describe('«Pedidos anteriores»', () => {
    it('el botón de texto aparece en el encabezado y abre la ventana de pedidos anteriores', async () => {
      await load(null);
      await click('Pedidos anteriores');
      expect(navigate).toHaveBeenCalledWith(restockHistoryModalLink());
    });

    it('también aparece con borrador', async () => {
      await load(DRAFT);
      expect(button('Pedidos anteriores')).toBeDefined();
    });

    it('mientras carga no aparece', async () => {
      await setup();
      expect(buttons('Pedidos anteriores')).toHaveLength(0);
      httpMock.match(() => true);
    });

    it('si la carga falla sigue visible', async () => {
      await setup();
      httpMock.expectOne(SUGGESTIONS_URL).flush({ error: { code: 'x', message: 'x' } }, { status: 500, statusText: 'Error' });
      httpMock.match(PRODUCTS_URL);
      httpMock.match(DRAFTS);
      await settle();
      expect(text()).toContain('No pudimos cargar la lista de resurtir');
      expect(buttons('Pedidos anteriores')).toHaveLength(1);
    });
  });

  describe('exportar el borrador guardado', () => {
    it('sin borrador (pedido nuevo) no hay botones de exportar', async () => {
      await load(null);
      expect(buttons('Exportar PDF')).toHaveLength(0);
      expect(buttons('Exportar Excel')).toHaveLength(0);
    });

    it('con borrador y sin cambios aparecen habilitados y sin la ayuda', async () => {
      await load(DRAFT);
      expect((button('Exportar PDF') as HTMLButtonElement).disabled).toBe(false);
      expect((button('Exportar Excel') as HTMLButtonElement).disabled).toBe(false);
      expect(text()).not.toContain(HELP);
    });

    it('exporta lo guardado: el documento sale del borrador del backend', async () => {
      await load(DRAFT);
      await click('Exportar PDF');
      expect(exporter.download).toHaveBeenCalledWith(buildExportDocument(DRAFT), 'pdf');
      await click('Exportar Excel');
      expect(exporter.download).toHaveBeenLastCalledWith(buildExportDocument(DRAFT), 'xlsx');
    });

    it('con cambios sin guardar quedan deshabilitados con «Guarda el pedido para exportarlo»', async () => {
      await load(DRAFT);
      await typeQty('9');
      expect((button('Exportar PDF') as HTMLButtonElement).disabled).toBe(true);
      expect((button('Exportar Excel') as HTMLButtonElement).disabled).toBe(true);
      expect(text()).toContain(HELP);
      button('Exportar PDF').click();
      expect(exporter.download).not.toHaveBeenCalled();
    });

    it('al guardar los cambios vuelven a habilitarse', async () => {
      await load(DRAFT);
      await typeQty('9');
      await click('Guardar pedido');
      httpMock.expectOne(`${ORDERS}/7`).flush({ order: { ...DRAFT, totalUnits: 9 } });
      await settle();
      expect((button('Exportar PDF') as HTMLButtonElement).disabled).toBe(false);
      expect(text()).not.toContain(HELP);
    });

    it('si falla la generación sale el toast de error y los botones se habilitan de nuevo', async () => {
      await load(DRAFT);
      exporter.download.mockRejectedValue(new Error('sin conexión'));
      await click('Exportar PDF');
      expect(toast.error).toHaveBeenCalledWith('No pudimos generar el archivo. Inténtalo de nuevo.');
      expect((button('Exportar PDF') as HTMLButtonElement).disabled).toBe(false);
    });

    it('exportar no manda ninguna petición de escritura', async () => {
      await load(DRAFT);
      await click('Exportar PDF');
      httpMock.expectNone((req) => req.method !== 'GET');
    });
  });
});
