import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { API_BASE_URL } from '@core/api-base-url';
import { ToastService } from '@core/toast/toast.service';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { closeModalLink, restockHistoryModalLink, restockModalLink } from '@shared/utils/modal-links';
import type { RestockOrder } from '../../interfaces/restock.models';
import { buildExportDocument } from '../../rules/restock-export.rules';
import { RestockExportService } from '../../services/restock-export.service';
import { RestockOrderPageComponent } from './restock-order-page.component';

const ORDER_URL = `${API_BASE_URL}/api/restock/orders/12`;

const ORDER: RestockOrder = {
  id: 12, status: 'closed', note: 'Pedir antes del viernes', createdAt: '2026-11-09T18:00:00Z',
  updatedAt: '2026-11-12T05:30:00Z', closedAt: '2026-11-12T05:30:00Z', lineCount: 2, totalUnits: 32,
  estimatedTotal: '999.00', requestId: 'r-12',
  lines: [{ product: { id: 1, name: 'Creatina 300 g', image: null }, qty: 30, unitCost: '12.5000' }],
  customLines: [{ id: 5, name: 'Shaker', qty: 2, unitCost: null }],
};

describe('RestockOrderPageComponent', () => {
  let fixture: ComponentFixture<RestockOrderPageComponent>;
  let httpMock: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let exporter: { download: ReturnType<typeof vi.fn> };

  const root = () => document.body;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const button = (label: string) =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.trim().includes(label))!;
  const click = async (label: string) => {
    button(label).click();
    await settle();
  };

  const setup = async () => {
    toast = { success: vi.fn(), error: vi.fn() };
    exporter = { download: vi.fn().mockResolvedValue(undefined) };
    const params = convertToParamMap({ id: '12' });
    await TestBed.configureTestingModule({
      imports: [RestockOrderPageComponent],
      providers: [
        MessageService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: params }, paramMap: of(params) } },
        { provide: ToastService, useValue: toast },
        { provide: RestockExportService, useValue: exporter },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(RestockOrderPageComponent);
    fixture.detectChanges();
  };
  const load = async (order: RestockOrder = ORDER) => {
    await setup();
    httpMock.expectOne(ORDER_URL).flush({ order });
    await settle();
  };

  afterEach(() => httpMock.verify());

  it('se pinta en un modal-panel con el título «Pedido de resurtir»', async () => {
    await load();
    expect(fixture.debugElement.query(By.directive(ModalPanelComponent)).componentInstance.title()).toBe('Pedido de resurtir');
  });

  it('cerrar el pop-up vuelve a «Stock general»', async () => {
    await load();
    fixture.debugElement.query(By.directive(ModalPanelComponent)).componentInstance.closed.emit();
    expect(navigate).toHaveBeenCalledWith(closeModalLink());
  });

  describe('estados', () => {
    it('mientras carga muestra un esqueleto', async () => {
      await setup();
      expect(root().querySelectorAll('p-skeleton').length).toBeGreaterThan(0);
      httpMock.expectOne(ORDER_URL).flush({ order: ORDER });
    });

    it('con 404 dice «Este pedido ya no existe» y «Volver a pedidos anteriores» abre la lista', async () => {
      await setup();
      httpMock.expectOne(ORDER_URL).flush({ error: { code: 'not_found', message: 'x' } }, { status: 404, statusText: 'Not Found' });
      await settle();
      expect(text()).toContain('Este pedido ya no existe');
      await click('Volver a pedidos anteriores');
      expect(navigate).toHaveBeenCalledWith(restockHistoryModalLink());
    });

    it('con otro error dice «No pudimos cargar el pedido» y «Reintentar» vuelve a pedirlo', async () => {
      await setup();
      httpMock.expectOne(ORDER_URL).flush({ error: { code: 'x', message: 'x' } }, { status: 500, statusText: 'Error' });
      await settle();
      expect(text()).toContain('No pudimos cargar el pedido');
      expect(text()).not.toContain('Este pedido ya no existe');
      await click('Reintentar');
      httpMock.expectOne(ORDER_URL).flush({ order: ORDER });
      await settle();
      expect(text()).not.toContain('No pudimos cargar el pedido');
    });
  });

  describe('pedido cerrado', () => {
    it('muestra el detalle en solo lectura con la nota, los renglones y el pie fijo', async () => {
      await load();
      expect(root().querySelector('app-restock-order-detail')).not.toBeNull();
      expect(root().querySelectorAll('app-restock-order-detail input, app-restock-order-detail textarea')).toHaveLength(0);
      expect(text()).toContain('Pedir antes del viernes');
      expect(text()).toContain('Creatina 300 g');
      expect(text()).toContain('2 productos · 32 piezas');
      expect(text()).toContain('Total estimado');
      expect(text()).toContain('$999.00');
    });

    it('«Volver a pedidos anteriores» abre la lista', async () => {
      await load();
      await click('Volver a pedidos anteriores');
      expect(navigate).toHaveBeenCalledWith(restockHistoryModalLink());
    });

    it('«Usar como base» navega a la ventana «resurtir» con el parámetro base', async () => {
      await load();
      await click('Usar como base');
      expect(navigate).toHaveBeenCalledWith(restockModalLink({ baseId: 12 }));
    });

    it('«Exportar PDF» y «Exportar Excel» bajan el documento del pedido en su formato', async () => {
      await load();
      await click('Exportar PDF');
      await click('Exportar Excel');
      expect(exporter.download).toHaveBeenNthCalledWith(1, buildExportDocument(ORDER), 'pdf');
      expect(exporter.download).toHaveBeenNthCalledWith(2, buildExportDocument(ORDER), 'xlsx');
    });

    it('mientras se genera, los dos botones quedan deshabilitados y un segundo clic no genera otro archivo', async () => {
      await load();
      let finish: () => void = () => undefined;
      exporter.download.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      await click('Exportar PDF');
      expect((button('Exportar PDF') as HTMLButtonElement).disabled).toBe(true);
      expect((button('Exportar Excel') as HTMLButtonElement).disabled).toBe(true);
      button('Exportar PDF').click();
      expect(exporter.download).toHaveBeenCalledTimes(1);
      finish();
      await settle();
      expect((button('Exportar PDF') as HTMLButtonElement).disabled).toBe(false);
    });

    it('si falla la generación avisa con un toast de error y vuelve a habilitar los botones', async () => {
      await load();
      exporter.download.mockRejectedValue(new Error('sin conexión'));
      await click('Exportar Excel');
      expect(toast.error).toHaveBeenCalledWith('No pudimos generar el archivo. Inténtalo de nuevo.');
      expect((button('Exportar PDF') as HTMLButtonElement).disabled).toBe(false);
      expect((button('Exportar Excel') as HTMLButtonElement).disabled).toBe(false);
    });

    it('ver el detalle y exportar no mandan ninguna petición de escritura', async () => {
      await load();
      await click('Exportar PDF');
      httpMock.expectNone((req) => req.method !== 'GET');
    });
  });

  describe('borrador', () => {
    it('un id de borrador abre el pop-up de resurtir en lugar de mostrarse en solo lectura', async () => {
      await load({ ...ORDER, status: 'draft', closedAt: null });
      expect(navigate).toHaveBeenCalled();
      expect(navigate.mock.calls[0][0]).toEqual(restockModalLink());
      expect(root().querySelector('app-restock-order-detail')).toBeNull();
    });
  });
});
