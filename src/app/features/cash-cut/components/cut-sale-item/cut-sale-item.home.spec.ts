import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { CutSale } from '../../interfaces/cash-cut.models';
import { CutSaleItemComponent } from './cut-sale-item.component';

// 2 piezas a $920, costo con envío $700 y de fábrica $600 (criterio 3).
const SALE: CutSale = {
  requestId: 'r-1',
  soldAt: '2026-11-04T18:42:00Z',
  registeredByAdmin: false,
  soldBy: { id: 'u-1', fullName: 'Luis Pérez' },
  total: '1840.00',
  profit: '440.00',
  realProfit: '640.00',
  shippingCover: '200.00',
  lines: [
    {
      productId: 3,
      name: 'Proteína Demo Whey',
      qty: 2,
      unitPrice: '920.00',
      subtotal: '1840.00',
      unitCost: '700.00',
      profit: '440.00',
      factoryUnitCost: '600.0000',
      realProfit: '640.00',
    },
  ],
};

describe('CutSaleItemComponent · corte para casa', () => {
  let fixture: ComponentFixture<CutSaleItemComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const allText = () => el().textContent?.replace(/\s+/g, ' ') ?? '';
  const toggle = () => el().querySelector('.toggle') as HTMLButtonElement;

  function render(sale: CutSale, showDate = false, home = true) {
    fixture = TestBed.createComponent(CutSaleItemComponent);
    fixture.componentRef.setInput('sale', sale);
    fixture.componentRef.setInput('showDate', showDate);
    if (home) {
      fixture.componentRef.setInput('cutType', 'home');
      fixture.componentRef.setInput('layout', 'overview');
    }
    fixture.detectChanges();
  }

  function expand() {
    toggle().click();
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [CutSaleItemComponent] }));

  it('plegada muestra hora, total y «Ganancia $640.00»', () => {
    render(SALE);
    expect(text('.time')).toBe('12:42');
    expect(text('.total')).toBe('$1,840.00');
    expect(text('.profit')).toBe('Ganancia $640.00');
  });

  it('con Semana o Mes muestra fecha y hora', () => {
    render(SALE, true);
    expect(text('.time')).toBe('4 nov · 12:42');
  });

  it('no muestra la ganancia del corte con precios ni «para cubrir envíos» por venta', () => {
    render(SALE);
    expect(allText()).not.toContain('$440.00');
    expect(allText()).not.toContain('envíos');
    expect(allText()).not.toContain('$200.00');
  });

  it('una ganancia real negativa se muestra con signo menos', () => {
    render({ ...SALE, realProfit: '-40.00' });
    expect(text('.profit')).toBe('Ganancia -$40.00');
  });

  it('«Registrada por ti» con registeredByAdmin', () => {
    render({ ...SALE, registeredByAdmin: true });
    expect(text('.admin-tag')).toBe('Registrada por ti');
  });

  it('al desplegarse cada producto muestra cantidad × precio, subtotal y su ganancia', () => {
    render(SALE);
    expand();
    expect(text('.line-name')).toBe('Proteína Demo Whey');
    expect(text('.line-detail')).toBe('2 × $920.00');
    expect(text('.line-subtotal')).toBe('$1,840.00');
    expect(text('.line-profit')).toBe('$640.00');
    expect(el().querySelector('.line-real-profit')).toBeNull();
  });

  it('sin cutType (corte con precios) ignora las llaves del corte para casa', () => {
    render(SALE, false, false);
    expect(text('.profit')).toBe('Ganancia $440.00');
    expect(el().querySelector('.real-profit')).toBeNull();
    expand();
    expect(text('.line-profit')).toBe('$440.00');
    expect(el().querySelector('.line-real-profit')).toBeNull();
  });
});
