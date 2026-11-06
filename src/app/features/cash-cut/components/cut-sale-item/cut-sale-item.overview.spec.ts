import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { CutSale, CutTypeValue } from '../../interfaces/cash-cut.models';
import { CutSaleItemComponent } from './cut-sale-item.component';

// 2 piezas a $920, costo con envío $700 y de fábrica $600 (criterio 3 de HU-21). Trae las llaves de
// los dos tipos de corte para comprobar que cada tipo lee la suya.
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

describe('CutSaleItemComponent · layout overview', () => {
  let fixture: ComponentFixture<CutSaleItemComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const allText = () => el().textContent?.replace(/\s+/g, ' ') ?? '';
  const toggle = () => el().querySelector('.toggle') as HTMLButtonElement;

  function render(sale: CutSale, cutType: CutTypeValue, showDate = false) {
    fixture = TestBed.createComponent(CutSaleItemComponent);
    fixture.componentRef.setInput('sale', sale);
    fixture.componentRef.setInput('showDate', showDate);
    fixture.componentRef.setInput('cutType', cutType);
    fixture.componentRef.setInput('layout', 'overview');
    fixture.detectChanges();
  }

  function expand() {
    toggle().click();
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [CutSaleItemComponent] }));

  it('con «Corte del vendedor» plegada muestra hora, total y «Ganancia $440.00»', () => {
    render(SALE, 'seller');
    expect(text('.time')).toBe('12:42');
    expect(text('.total')).toBe('$1,840.00');
    expect(text('.profit')).toBe('Ganancia $440.00');
    expect(el().querySelector('.real-profit')).toBeNull();
    expect(el().querySelector('.lines')).toBeNull();
  });

  it('con «Corte de casa» plegada muestra «Ganancia $640.00» (sale.realProfit), sin «Ganancia real»', () => {
    render(SALE, 'home');
    expect(text('.time')).toBe('12:42');
    expect(text('.total')).toBe('$1,840.00');
    expect(text('.profit')).toBe('Ganancia $640.00');
    expect(el().querySelector('.real-profit')).toBeNull();
    expect(allText()).not.toContain('Ganancia real');
    expect(allText()).not.toContain('$440.00');
  });

  it('con Semana o Mes muestra fecha y hora', () => {
    render(SALE, 'home', true);
    expect(text('.time')).toBe('4 nov · 12:42');
  });

  it('con «Corte del vendedor» una ganancia negativa se muestra «Ganancia -$40.00»', () => {
    render({ ...SALE, profit: '-40.00' }, 'seller');
    expect(text('.profit')).toBe('Ganancia -$40.00');
  });

  it('con «Corte de casa» una ganancia real negativa se muestra «Ganancia -$40.00»', () => {
    render({ ...SALE, realProfit: '-40.00' }, 'home');
    expect(text('.profit')).toBe('Ganancia -$40.00');
  });

  it('«Registrada por ti» con registeredByAdmin', () => {
    render({ ...SALE, registeredByAdmin: true }, 'seller');
    expect(text('.admin-tag')).toBe('Registrada por ti');
  });

  it('con «Corte del vendedor» al desplegarse cada producto muestra cantidad × precio, subtotal y su ganancia', () => {
    render(SALE, 'seller');
    expand();
    expect(text('.line-name')).toBe('Proteína Demo Whey');
    expect(text('.line-detail')).toBe('2 × $920.00');
    expect(text('.line-subtotal')).toBe('$1,840.00');
    expect(text('.line-profit')).toBe('$440.00');
    expect(el().querySelector('.line-real-profit')).toBeNull();
  });

  it('con «Corte de casa» al desplegarse la ganancia de cada producto sale de line.realProfit', () => {
    render(SALE, 'home');
    expand();
    expect(text('.line-name')).toBe('Proteína Demo Whey');
    expect(text('.line-detail')).toBe('2 × $920.00');
    expect(text('.line-subtotal')).toBe('$1,840.00');
    expect(text('.line-profit')).toBe('$640.00');
    expect(el().querySelector('.line-real-profit')).toBeNull();
  });
});
