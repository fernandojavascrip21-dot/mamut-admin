import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ProductSummary } from '../../interfaces/product.models';
import { ProductCardComponent } from './product-card.component';

// parentProductId y portionUnitCost son campos nuevos de ProductSummary (HU-24).
const BASE = {
  id: 1, name: 'Creatina', categoryId: null, price: '85.00', stock: 7, fractionable: false, image: '',
};
const WHOLE = { ...BASE, fractionable: true, parentProductId: null, portionUnitCost: null } as ProductSummary;
const BAG = { ...BASE, name: 'Creatina · bolsita 30 g', parentProductId: 9, portionUnitCost: '64.2857' } as ProductSummary;
const NORMAL = { ...BASE, parentProductId: null, portionUnitCost: null } as ProductSummary;

describe('ProductCardComponent · bolsita (HU-24)', () => {
  let fixture: ComponentFixture<ProductCardComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  const labels = () => Array.from(el().querySelectorAll('.tags span')).map((n) => n.textContent!.trim());

  async function render(product: ProductSummary, holderLabel: string | null = null, stockLevel: 'ok' | 'low' | 'out' | null = null) {
    fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentRef.setInput('product', product);
    fixture.componentRef.setInput('holderLabel', holderLabel);
    fixture.componentRef.setInput('stockLevel', stockLevel);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [ProductCardComponent], providers: [provideRouter([])] }));

  it('la bolsita muestra «Fraccionado»', async () => {
    await render(BAG);
    expect(labels()).toEqual(['Fraccionado']);
  });

  it('el entero fraccionable no muestra ninguna etiqueta de fraccionado', async () => {
    await render(WHOLE);
    expect(labels()).toEqual([]);
    expect(text()).not.toContain('Fraccionado');
    expect(text()).not.toContain('Se fracciona');
  });

  it('un producto normal no muestra ninguna de las dos', async () => {
    await render(NORMAL);
    expect(labels()).toEqual([]);
  });

  it('«Agotado» y «Baja existencia» van antes de «Fraccionado»', async () => {
    await render({ ...BAG, stock: 0 });
    expect(labels()).toEqual(['Agotado', 'Fraccionado']);
    await render(BAG, null, 'low');
    expect(labels()).toEqual(['Baja existencia', 'Fraccionado']);
  });

  it('con «Yo · bodega» la bolsita muestra «Costo $64.29» además del precio', async () => {
    await render(BAG, null);
    expect(text()).toContain('Costo $64.29');
    expect(text()).toContain('$85.00');
  });

  it('con un vendedor en «Viendo» la bolsita no muestra el costo', async () => {
    await render(BAG, 'Luis');
    expect(text()).not.toContain('Costo');
    expect(text()).not.toContain('$64.29');
  });

  it('el entero y el producto normal no muestran «Costo»', async () => {
    await render(WHOLE);
    expect(text()).not.toContain('Costo');
    await render(NORMAL);
    expect(text()).not.toContain('Costo');
  });

  it('no hay botón «Fraccionar» en el pie, ni con un entero con piezas en la bodega', async () => {
    await render(WHOLE);
    expect(text()).not.toContain('Fraccionar');
    expect(el().querySelector('a[href*="fraccionar"]')).toBeNull();
  });
});
