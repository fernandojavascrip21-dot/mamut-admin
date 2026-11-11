import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { API_BASE_URL } from '@core/api-base-url';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { closeModalLink, restockModalLink } from '@shared/utils/modal-links';
import type { RestockOrderSummary } from '../../interfaces/restock.models';
import { RestockHistoryPageComponent } from './restock-history-page.component';

const CLOSED_URL = `${API_BASE_URL}/api/restock/orders?status=closed`;

const summary = (id: number, closedAt: string, extra: Partial<RestockOrderSummary> = {}): RestockOrderSummary => ({
  id, status: 'closed', note: null, createdAt: '2026-11-01T18:00:00Z', updatedAt: closedAt, closedAt,
  lineCount: 3, totalUnits: 42, estimatedTotal: '1234.50', ...extra,
});

describe('RestockHistoryPageComponent', () => {
  let fixture: ComponentFixture<RestockHistoryPageComponent>;
  let httpMock: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  const root = () => document.body;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const button = (label: string) =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.trim() === label)!;

  const setup = async () => {
    await TestBed.configureTestingModule({
      imports: [RestockHistoryPageComponent],
      providers: [MessageService, provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(RestockHistoryPageComponent);
    fixture.detectChanges();
  };
  const load = async (orders: RestockOrderSummary[]) => {
    await setup();
    httpMock.expectOne(CLOSED_URL).flush({ orders });
    await settle();
  };

  afterEach(() => httpMock.verify());

  it('se pinta en un modal-panel con el título «Pedidos anteriores»', async () => {
    await load([summary(1, '2026-11-01T18:00:00Z')]);
    const panel = fixture.debugElement.query(By.directive(ModalPanelComponent));
    expect(panel.componentInstance.title()).toBe('Pedidos anteriores');
  });

  it('cerrar el pop-up vuelve a «Stock general»', async () => {
    await load([]);
    fixture.debugElement.query(By.directive(ModalPanelComponent)).componentInstance.closed.emit();
    expect(navigate).toHaveBeenCalledWith(closeModalLink());
  });

  describe('estados', () => {
    it('mientras carga muestra un esqueleto de 3 renglones', async () => {
      await setup();
      expect(root().querySelectorAll('p-skeleton').length).toBeGreaterThanOrEqual(3);
      httpMock.expectOne(CLOSED_URL).flush({ orders: [] });
    });

    it('si falla muestra «No pudimos cargar los pedidos anteriores» y «Reintentar» vuelve a pedir', async () => {
      await setup();
      httpMock.expectOne(CLOSED_URL).flush({ error: { code: 'x', message: 'x' } }, { status: 500, statusText: 'Error' });
      await settle();
      expect(text()).toContain('No pudimos cargar los pedidos anteriores');
      button('Reintentar').click();
      fixture.detectChanges();
      httpMock.expectOne(CLOSED_URL).flush({ orders: [summary(1, '2026-11-01T18:00:00Z')] });
      await settle();
      expect(text()).not.toContain('No pudimos cargar los pedidos anteriores');
    });

    it('sin pedidos cerrados muestra el vacío y «Volver al pedido»', async () => {
      await load([]);
      expect(text()).toContain('Todavía no hay pedidos cerrados');
      expect(text()).toContain('Cuando cierres un pedido aparecerá aquí.');
      expect(button('Volver al pedido')).toBeDefined();
    });
  });

  describe('lista', () => {
    it('pinta un renglón por pedido con el de cierre más reciente arriba', async () => {
      await load([
        summary(1, '2026-11-01T18:00:00Z'),
        summary(2, '2026-11-09T18:00:00Z'),
        summary(3, '2026-11-05T18:00:00Z'),
      ]);
      const hrefs = Array.from(root().querySelectorAll('app-restock-history-item a')).map((a) => a.getAttribute('href'));
      expect(hrefs).toHaveLength(3);
      expect(hrefs.map((href) => Number(href!.match(/(\d+)\)?$/)![1]))).toEqual([2, 3, 1]);
    });

    it('cada renglón es un enlace al detalle con fecha, productos, piezas y total', async () => {
      await load([summary(12, '2026-11-12T05:30:00Z', { note: 'Urgente' })]);
      expect(root().querySelector('app-restock-history-item a')!.getAttribute('href')).toContain('resurtir/pedidos/12');
      expect(text()).toContain('Cerrado el 11 nov 2026');
      expect(text()).toContain('3 productos · 42 piezas');
      expect(text()).toContain('$1,234.50');
      expect(text()).toContain('Urgente');
    });

    it('«Volver al pedido» abre la ventana «resurtir»', async () => {
      await load([summary(1, '2026-11-01T18:00:00Z')]);
      button('Volver al pedido').click();
      expect(navigate).toHaveBeenCalledWith(restockModalLink());
    });
  });
});
