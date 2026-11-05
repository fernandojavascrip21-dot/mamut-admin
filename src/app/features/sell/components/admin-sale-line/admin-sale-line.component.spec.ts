import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { AdminSaleLine } from '../../interfaces/sale.models';
import { AdminSaleLineComponent } from './admin-sale-line.component';

const LINE: AdminSaleLine = {
  productId: 3,
  name: 'Proteína Demo Whey',
  image: null,
  qty: 2,
  unitPrice: '920.00',
  subtotal: '1840.00',
  unitCost: '610.5000',
  profit: '619.00',
  stock: { before: 4, after: 2 }, stockLevel: 'low',
};

describe('AdminSaleLineComponent', () => {
  let fixture: ComponentFixture<AdminSaleLineComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  function render(line: AdminSaleLine, holderLabel: string) {
    fixture = TestBed.createComponent(AdminSaleLineComponent);
    fixture.componentRef.setInput('line', line);
    fixture.componentRef.setInput('holderLabel', holderLabel);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [AdminSaleLineComponent] }));

  it('muestra nombre, piezas × precio c/u, subtotal y ganancia del renglón', () => {
    render(LINE, 'Bodega');
    expect(text('.name')).toBe('Proteína Demo Whey');
    expect(text('.detail')).toBe('2 × $920.00 c/u');
    expect(text('.subtotal')).toBe('$1,840.00');
    expect(text('.profit')).toBe('Ganancia $619.00');
  });

  it('con la bodega muestra «Bodega: 4 → 2»', () => {
    render(LINE, 'Bodega');
    expect(text('.stock-change')).toBe('Bodega: 4 → 2');
  });

  it('con un vendedor muestra «Luis: 6 → 4»', () => {
    render({ ...LINE, stock: { before: 6, after: 4 }, stockLevel: 'ok' }, 'Luis');
    expect(text('.stock-change')).toBe('Luis: 6 → 4');
  });

  it('«low» muestra «Baja existencia» junto al cambio de stock', () => {
    render({ ...LINE, stock: { before: 4, after: 2 }, stockLevel: 'low' }, 'Bodega');
    expect(text('.level')).toBe('Baja existencia');
  });

  it('«out» muestra «Agotado»: «Luis: 3 → 0»', () => {
    render({ ...LINE, stock: { before: 3, after: 0 }, stockLevel: 'out' }, 'Luis');
    expect(text('.stock-change')).toBe('Luis: 3 → 0');
    expect(text('.level')).toBe('Agotado');
  });

  it('«ok» no muestra etiqueta', () => {
    render({ ...LINE, stock: { before: 6, after: 4 }, stockLevel: 'ok' }, 'Luis');
    expect(el().querySelector('.level')).toBeNull();
  });

  it('sin foto muestra las iniciales; con foto, la imagen', () => {
    render(LINE, 'Bodega');
    expect(el().querySelector('img')).toBeNull();
    expect(el().textContent).toContain('PD');
    render({ ...LINE, image: 'https://example.com/p.jpg' }, 'Bodega');
    expect(el().querySelector('img')?.getAttribute('src')).toBe('https://example.com/p.jpg');
  });

  it('no muestra el costo unitario', () => {
    render(LINE, 'Bodega');
    expect(el().textContent).not.toContain('610');
  });
});
