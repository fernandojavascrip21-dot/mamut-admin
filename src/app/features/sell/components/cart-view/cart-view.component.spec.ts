import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ADMIN_CART_PAGE_TEXTS } from '../../constants/admin-cart-page.constants';
import { CART_PAGE_TEXTS } from '../../constants/cart-page.constants';
import type { CartConfirmError, CartPageState, CartRow } from '../../models/cart-page.models';
import { CartViewComponent } from './cart-view.component';

const ROW: CartRow = {
  product: { productId: 1, name: 'Creatina', image: null, units: 6, price: '450.00' },
  units: 2,
  available: 6,
  subtotal: '900.00',
  status: 'ok',
};

interface Inputs {
  state?: CartPageState;
  rows?: CartRow[];
  profitAmount?: number | null;
  holderName?: string | null;
  confirmError?: CartConfirmError | null;
  needsFix?: boolean;
  admin?: boolean;
}

describe('CartViewComponent', () => {
  let fixture: ComponentFixture<CartViewComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  function render(inputs: Inputs = {}) {
    fixture = TestBed.createComponent(CartViewComponent);
    const ref = fixture.componentRef;
    ref.setInput('texts', inputs.admin ? ADMIN_CART_PAGE_TEXTS : CART_PAGE_TEXTS);
    ref.setInput('state', inputs.state ?? 'ready');
    ref.setInput('rows', inputs.rows ?? [ROW]);
    ref.setInput('piecesLabel', '2 piezas');
    ref.setInput('totalAmount', 900);
    ref.setInput('keepSellingUrl', inputs.admin ? '/admin/productos' : '/vendedor/vender');
    ref.setInput('profitAmount', inputs.profitAmount ?? null);
    ref.setInput('holderName', inputs.holderName ?? null);
    ref.setInput('confirmError', inputs.confirmError ?? null);
    ref.setInput('needsFix', inputs.needsFix ?? false);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [CartViewComponent], providers: [provideRouter([])] }));

  it('vendedor (sin ganancia ni titular): total y resumen, y nada de ganancia ni «Vendiendo de»', () => {
    render();
    expect(text('.total')).toBe('$900.00');
    expect(text('.pieces')).toBe('2 piezas');
    expect(el().querySelector('.profit')).toBeNull();
    expect(el().querySelector('.holder')).toBeNull();
    expect(el().textContent).not.toContain('Ganancia');
  });

  it('administrador (con ganancia y titular): los muestra', () => {
    render({ admin: true, profitAmount: 350, holderName: 'Luis Pérez' });
    expect(text('.profit')).toBe('$350.00');
    expect(text('.holder')).toBe('Vendiendo de: Luis Pérez');
  });

  it('los dos roles tienen el mismo diseño: «← Seguir vendiendo» arriba y panel de resumen', () => {
    render();
    expect(text('.keep-selling')).toBe('← Seguir vendiendo');
    expect(el().querySelector('.keep-selling')?.getAttribute('href')).toBe('/vendedor/vender');
    expect(el().querySelector('aside.summary')).not.toBeNull();
    expect(text('.summary-line')).toContain('Creatina');
  });

  it('el resumen solo suma los renglones que alcanzan', () => {
    render({ rows: [ROW, { ...ROW, product: { ...ROW.product, productId: 2, name: 'Isolate' }, status: 'over' }] });
    expect(el().querySelectorAll('.summary-line')).toHaveLength(1);
  });

  it('carrito vacío: «Ir a …» con el destino del rol y sin enlace de arriba', () => {
    render({ state: 'empty', rows: [], admin: true });
    expect(text('.empty')).toContain('Tu carrito está vacío');
    expect(el().querySelector('.go-sell')?.getAttribute('href')).toBe('/admin/productos');
    expect(el().querySelector('.keep-selling')).toBeNull();
  });

  it('cargando y error: «Reintentar» emite retry', () => {
    render({ state: 'loading' });
    expect(el().querySelector('[role="status"]')).not.toBeNull();
    render({ state: 'error' });
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);
    (el().querySelector('.retry') as HTMLButtonElement).click();
    expect(retry).toHaveBeenCalledOnce();
  });

  it('confirmar emite confirm y, con renglones por corregir, está deshabilitado con su aviso', () => {
    render();
    const confirm = vi.fn();
    fixture.componentInstance.confirm.subscribe(confirm);
    (el().querySelector('.confirm') as HTMLButtonElement).click();
    expect(confirm).toHaveBeenCalledOnce();
    render({ needsFix: true });
    expect((el().querySelector('.confirm') as HTMLButtonElement).disabled).toBe(true);
    expect(text('.confirm-hint')).toBe('Corrige los productos marcados para confirmar');
  });

  it('sin conexión muestra el aviso y «Reintentar» emite retrySend', () => {
    render({ confirmError: 'offline' });
    const retrySend = vi.fn();
    fixture.componentInstance.retrySend.subscribe(retrySend);
    expect(text('.confirm-error')).toContain('No hay conexión');
    (el().querySelector('.retry-send') as HTMLButtonElement).click();
    expect(retrySend).toHaveBeenCalledOnce();
  });

  it('+, − y quitar de un renglón emiten el renglón', () => {
    render();
    const inc = vi.fn();
    fixture.componentInstance.increment.subscribe(inc);
    (el().querySelector('app-cart-line .increment') as HTMLButtonElement).click();
    expect(inc).toHaveBeenCalledWith(ROW);
  });
});
