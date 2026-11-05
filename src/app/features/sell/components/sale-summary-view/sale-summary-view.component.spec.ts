import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ADMIN_SALE_SUMMARY_LINKS, ADMIN_SALE_SUMMARY_TEXTS } from '../../constants/admin-sale-summary-page.constants';
import { SALE_SUMMARY_LINKS, SALE_SUMMARY_TEXTS } from '../../constants/sale-summary-page.constants';
import type { AdminSale, Sale } from '../../interfaces/sale.models';
import type { SaleSummaryState } from '../../models/sale-summary-page.models';
import { SaleSummaryViewComponent } from './sale-summary-view.component';

const SELLER_SALE: Sale = {
  id: 1,
  requestId: 'r-1',
  soldAt: '2026-11-04T18:42:00Z',
  soldById: 'v-1',
  holder: null,
  total: '1840.00',
  lines: [
    { productId: 3, name: 'Proteína Demo', image: null, qty: 2, unitPrice: '920.00', subtotal: '1840.00', stock: { before: 6, after: 4 }, stockLevel: 'ok' },
  ],
};
const ADMIN_SALE: AdminSale = {
  ...SELLER_SALE,
  profit: '440.00',
  lines: [{ ...SELLER_SALE.lines[0]!, unitCost: '700.0000', profit: '440.00' }],
};

interface Inputs {
  state?: SaleSummaryState;
  sale?: Sale | null;
  admin?: boolean;
  lowStockNotice?: string | null;
  replayed?: boolean;
}

describe('SaleSummaryViewComponent', () => {
  let fixture: ComponentFixture<SaleSummaryViewComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  function render(inputs: Inputs = {}) {
    fixture = TestBed.createComponent(SaleSummaryViewComponent);
    const ref = fixture.componentRef;
    const admin = inputs.admin ?? false;
    ref.setInput('texts', admin ? ADMIN_SALE_SUMMARY_TEXTS : SALE_SUMMARY_TEXTS);
    ref.setInput('links', admin ? ADMIN_SALE_SUMMARY_LINKS : SALE_SUMMARY_LINKS);
    ref.setInput('state', inputs.state ?? 'ready');
    ref.setInput('sale', inputs.sale === undefined ? (admin ? ADMIN_SALE : SELLER_SALE) : inputs.sale);
    ref.setInput('totalAmount', 1840);
    ref.setInput('countsLabel', '1 producto · 2 piezas');
    ref.setInput('replayed', inputs.replayed ?? false);
    ref.setInput('lowStockNotice', inputs.lowStockNotice ?? null);
    if (admin) {
      ref.setInput('holderName', 'Bodega');
      ref.setInput('holderLabel', 'Bodega');
      ref.setInput('profitAmount', 440);
    }
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [SaleSummaryViewComponent], providers: [provideRouter([])] }));

  it('vendedor: mismo diseño (conteo, total, botones) pero sin ganancia, sin titular y con «Te quedan N»', () => {
    render();
    expect(text('h1')).toBe('Venta confirmada');
    expect(text('.counts')).toBe('1 producto · 2 piezas');
    expect(text('.total')).toBe('$1,840.00');
    expect(el().querySelector('aside .new-sale')).not.toBeNull();
    expect(el().querySelector('.profit')).toBeNull();
    expect(el().querySelector('.profit-summary')).toBeNull();
    expect(el().querySelector('.holder')).toBeNull();
    expect(text('.stock-left')).toBe('Te quedan 4');
    expect(el().textContent).not.toContain('Ganancia');
    expect(el().textContent).not.toContain('700');
  });

  it('administrador: titular, ganancia de la venta y del renglón, y «antes → después»', () => {
    render({ admin: true });
    expect(text('.holder')).toBe('Vendido de: Bodega');
    expect(text('.profit-summary .profit')).toBe('$440.00');
    expect(text('app-sale-line .profit')).toBe('Ganancia $440.00');
    expect(text('.stock-change')).toBe('Bodega: 6 → 4');
  });

  it('el aviso de baja existencia solo sale si llega', () => {
    render({ lowStockNotice: 'Se avisó al administrador que te quedan pocas piezas de: Creatina.' });
    expect(text('.low-stock-notice')).toContain('Creatina');
    render();
    expect(el().querySelector('.low-stock-notice')).toBeNull();
  });

  it('muestra el aviso de venta repetida y los enlaces del rol', () => {
    render({ replayed: true, admin: true });
    expect(text('.replayed')).toContain('ya se había registrado');
    expect(el().querySelector('.view-stock')?.getAttribute('href')).toBe('/admin/stock');
    expect(el().querySelector('.new-sale')?.getAttribute('href')).toBe('/admin/productos');
  });

  it('no encontrada, error con «Reintentar» (emite retry) y cargando', () => {
    render({ state: 'not-found', sale: null });
    expect(el().querySelector('.not-found')).not.toBeNull();
    render({ state: 'error', sale: null });
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);
    (el().querySelector('.retry') as HTMLButtonElement).click();
    expect(retry).toHaveBeenCalledOnce();
    render({ state: 'loading', sale: null });
    expect(el().querySelector('.loading')).not.toBeNull();
  });
});
