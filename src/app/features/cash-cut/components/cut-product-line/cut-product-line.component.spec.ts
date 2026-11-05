import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { CutProductLine } from '../../interfaces/cash-cut.models';
import { CutProductLineComponent } from './cut-product-line.component';

const LINE: CutProductLine = {
  productId: 3,
  name: 'Proteína Demo Whey',
  image: null,
  unitPrice: '920.00',
  units: 2,
  total: '1840.00',
  cost: '1400.0000',
  profit: '440.00',
};

describe('CutProductLineComponent', () => {
  let fixture: ComponentFixture<CutProductLineComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  function render(line: CutProductLine, withShipping = true) {
    fixture = TestBed.createComponent(CutProductLineComponent);
    fixture.componentRef.setInput('line', line);
    fixture.componentRef.setInput('withShipping', withShipping);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [CutProductLineComponent] }));

  it('muestra nombre, «2 × $920.00», costo con envío, subtotal y ganancia', () => {
    render(LINE);
    expect(text('.name')).toBe('Proteína Demo Whey');
    expect(text('.detail')).toBe('2 × $920.00');
    expect(text('.cost')).toBe('costo con envío $1,400.00');
    expect(text('.total')).toBe('$1,840.00');
    expect(text('.profit')).toBe('+$440.00');
  });

  it('con la bodega la etiqueta es «costo»', () => {
    render(LINE, false);
    expect(text('.cost')).toBe('costo $1,400.00');
  });

  it('una ganancia negativa lleva signo menos y no «+»', () => {
    render({ ...LINE, profit: '-40.00' });
    expect(text('.profit')).toBe('-$40.00');
  });

  it('sin costo ni ganancia no muestra esos datos', () => {
    render({ ...LINE, cost: undefined, profit: undefined });
    expect(el().querySelector('.cost')).toBeNull();
    expect(el().querySelector('.profit')).toBeNull();
    expect(text('.total')).toBe('$1,840.00');
  });

  it('sin foto muestra las iniciales; con foto, la imagen', () => {
    render(LINE);
    expect(el().querySelector('img')).toBeNull();
    expect(el().textContent).toContain('PD');
    render({ ...LINE, image: 'https://example.com/p.jpg' });
    expect(el().querySelector('img')?.getAttribute('src')).toBe('https://example.com/p.jpg');
  });
});
