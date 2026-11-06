import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { CutProductLine, CutTypeValue } from '../../interfaces/cash-cut.models';
import { CutProductLineComponent } from './cut-product-line.component';

// 2 piezas a $920, costo con envío $700 y de fábrica $600 (criterio 3 de HU-21). Trae las llaves de
// los dos tipos de corte para comprobar que cada tipo lee la suya.
const LINE: CutProductLine = {
  productId: 3,
  name: 'Proteína Demo Whey',
  image: null,
  unitPrice: '920.00',
  units: 2,
  total: '1840.00',
  cost: '1400.0000',
  profit: '440.00',
  factoryCost: '1200.0000',
  realProfit: '640.00',
  shippingCover: '200.00',
};

describe('CutProductLineComponent · layout overview', () => {
  let fixture: ComponentFixture<CutProductLineComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const allText = () => el().textContent?.replace(/\s+/g, ' ') ?? '';

  function render(line: CutProductLine, cutType: CutTypeValue, withShipping = true) {
    fixture = TestBed.createComponent(CutProductLineComponent);
    fixture.componentRef.setInput('line', line);
    fixture.componentRef.setInput('withShipping', withShipping);
    fixture.componentRef.setInput('cutType', cutType);
    fixture.componentRef.setInput('layout', 'overview');
    fixture.detectChanges();
  }

  function expectNoCostLine() {
    expect(el().querySelector('.cost')).toBeNull();
    expect(el().querySelector('.factory-cost')).toBeNull();
    expect(el().querySelector('.real-profit')).toBeNull();
    expect(allText()).not.toContain('costo');
    expect(allText()).not.toContain('$1,400.00');
    expect(allText()).not.toContain('$1,200.00');
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [CutProductLineComponent] }));

  it('con «Corte del vendedor» muestra nombre, «2 × $920.00», subtotal y «+$440.00», sin costo', () => {
    render(LINE, 'seller');
    expect(text('.name')).toBe('Proteína Demo Whey');
    expect(text('.detail')).toBe('2 × $920.00');
    expect(text('.total')).toBe('$1,840.00');
    expect(text('.profit')).toBe('+$440.00');
    expectNoCostLine();
  });

  it('con «Corte de casa» la ganancia del renglón sale de line.realProfit: «+$640.00»', () => {
    render(LINE, 'home');
    expect(text('.name')).toBe('Proteína Demo Whey');
    expect(text('.detail')).toBe('2 × $920.00');
    expect(text('.total')).toBe('$1,840.00');
    expect(text('.profit')).toBe('+$640.00');
    expect(allText()).not.toContain('$440.00');
    expectNoCostLine();
  });

  it('con la bodega tampoco hay línea de costo', () => {
    render(LINE, 'seller', false);
    expect(text('.profit')).toBe('+$440.00');
    expectNoCostLine();
  });

  it('con «Corte del vendedor» una ganancia negativa lleva signo menos y no «+»', () => {
    render({ ...LINE, profit: '-40.00' }, 'seller');
    expect(text('.profit')).toBe('-$40.00');
  });

  it('con «Corte de casa» una ganancia real negativa lleva signo menos y no «+»', () => {
    render({ ...LINE, realProfit: '-40.00' }, 'home');
    expect(text('.profit')).toBe('-$40.00');
  });
});
