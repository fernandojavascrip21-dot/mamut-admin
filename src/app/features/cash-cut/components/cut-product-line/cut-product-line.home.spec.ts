import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { CutProductLine } from '../../interfaces/cash-cut.models';
import { CutProductLineComponent } from './cut-product-line.component';

// 2 piezas a $920, costo con envío $700 y de fábrica $600 (criterio 3).
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

describe('CutProductLineComponent · corte para casa', () => {
  let fixture: ComponentFixture<CutProductLineComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const allText = () => el().textContent?.replace(/\s+/g, ' ') ?? '';

  function render(line: CutProductLine, home = true) {
    fixture = TestBed.createComponent(CutProductLineComponent);
    fixture.componentRef.setInput('line', line);
    fixture.componentRef.setInput('withShipping', true);
    if (home) fixture.componentRef.setInput('cutType', 'home');
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [CutProductLineComponent] }));

  it('muestra «2 × $920.00», «costo de fábrica $1,200.00», el subtotal y «+$640.00»', () => {
    render(LINE);
    expect(text('.name')).toBe('Proteína Demo Whey');
    expect(text('.detail')).toBe('2 × $920.00');
    expect(text('.factory-cost')).toBe('costo de fábrica $1,200.00');
    expect(text('.total')).toBe('$1,840.00');
    expect(text('.real-profit')).toBe('+$640.00');
  });

  it('no muestra «costo con envío» ni el costo y la ganancia del corte con precios', () => {
    render(LINE);
    expect(allText()).not.toContain('costo con envío');
    expect(el().querySelector('.cost')).toBeNull();
    expect(el().querySelector('.profit')).toBeNull();
    expect(allText()).not.toContain('$1,400.00');
    expect(allText()).not.toContain('$440.00');
  });

  it('no muestra «para cubrir envíos» por renglón', () => {
    render(LINE);
    expect(allText()).not.toContain('envíos');
    expect(allText()).not.toContain('$200.00');
  });

  it('una ganancia real negativa lleva signo menos y no «+»', () => {
    render({ ...LINE, realProfit: '-40.00' });
    expect(text('.real-profit')).toBe('-$40.00');
  });

  it('sin cutType (corte con precios) ignora las llaves del corte para casa', () => {
    render(LINE, false);
    expect(text('.cost')).toBe('costo con envío $1,400.00');
    expect(text('.profit')).toBe('+$440.00');
    expect(el().querySelector('.factory-cost')).toBeNull();
    expect(el().querySelector('.real-profit')).toBeNull();
  });
});
