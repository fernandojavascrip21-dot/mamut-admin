import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { SellProduct } from '../../interfaces/sell-stock.models';
import { SellProductCardComponent } from './sell-product-card.component';

const PRODUCT: SellProduct = { productId: 3, name: 'Proteína Whey', image: null, units: 3, price: '750.00' };

describe('SellProductCardComponent', () => {
  let fixture: ComponentFixture<SellProductCardComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  const button = (selector: string) => el().querySelector(selector) as HTMLButtonElement | null;

  async function render(product: SellProduct, unitsInCart = 0) {
    fixture = TestBed.createComponent(SellProductCardComponent);
    fixture.componentRef.setInput('product', product);
    fixture.componentRef.setInput('unitsInCart', unitsInCart);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SellProductCardComponent] }).compileComponents();
  });

  it('muestra el nombre, el precio en pesos y «Quedan N»', async () => {
    await render(PRODUCT);
    expect(text()).toContain('Proteína Whey');
    expect(text()).toContain('$750.00');
    expect(text()).toContain('Quedan 3');
  });

  it('«Quedan N» descuenta lo que ya está en el carrito, y con una pieza dice «Queda 1»', async () => {
    await render(PRODUCT, 2);
    expect(text()).toContain('Queda 1');
    await render(PRODUCT, 1);
    expect(text()).toContain('Quedan 2');
  });

  it('sin el producto en el carrito ofrece «+ Agregar» y emite add', async () => {
    await render(PRODUCT);
    const add = vi.fn();
    fixture.componentInstance.add.subscribe(add);
    expect(button('.stepper')).toBeNull();
    button('.add')!.click();
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('el botón «+ Agregar» tiene nombre accesible con el producto', async () => {
    await render(PRODUCT);
    expect(button('.add')!.getAttribute('aria-label')).toBe('+ Agregar Proteína Whey');
  });

  it('con el producto en el carrito muestra −, las piezas y +, y emite increment y decrement', async () => {
    await render(PRODUCT, 2);
    const inc = vi.fn();
    const dec = vi.fn();
    fixture.componentInstance.increment.subscribe(inc);
    fixture.componentInstance.decrement.subscribe(dec);

    expect(button('.add')).toBeNull();
    expect(el().querySelector('.units')!.textContent!.trim()).toBe('2');
    expect(button('.increment')!.getAttribute('aria-label')).toBe('Agregar una pieza de Proteína Whey');
    expect(button('.decrement')!.getAttribute('aria-label')).toBe('Quitar una pieza de Proteína Whey');

    button('.increment')!.click();
    button('.decrement')!.click();
    expect(inc).toHaveBeenCalledTimes(1);
    expect(dec).toHaveBeenCalledTimes(1);
  });

  it('el + se deshabilita en el tope (criterio 3) y el − sigue activo', async () => {
    await render(PRODUCT, 3);
    expect(button('.increment')!.disabled).toBe(true);
    expect(button('.decrement')!.disabled).toBe(false);
    expect(text()).toContain('Quedan 0');
  });

  it('un carrito que pide más de lo que hay no deja subir y no muestra números negativos', async () => {
    await render({ ...PRODUCT, units: 2 }, 5);
    expect(button('.increment')!.disabled).toBe(true);
    expect(text()).toContain('Quedan 0');
    expect(text()).not.toContain('-');
  });

  it('sin piezas sale «Agotado» deshabilitado y «Sin piezas», sin poder agregar (criterio 6)', async () => {
    await render({ ...PRODUCT, units: 0 });
    const soldOut = button('.sold-out')!;
    expect(soldOut.textContent!.trim()).toBe('Agotado');
    expect(soldOut.disabled).toBe(true);
    expect(text()).toContain('Sin piezas');
    expect(button('.add')).toBeNull();
    expect(button('.stepper')).toBeNull();
  });

  it('muestra el precio que recibe, sea el propio o el general', async () => {
    await render({ ...PRODUCT, price: '920.00' });
    expect(text()).toContain('$920.00');
    expect(text()).not.toContain('$750.00');
  });

  it('con foto la muestra con su texto alternativo; sin foto, o si falla, las iniciales', async () => {
    await render({ ...PRODUCT, image: 'https://cdn.test/whey.png' });
    const img = el().querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('alt')).toBe('Proteína Whey');

    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el().querySelector('img')).toBeNull();
    expect(text()).toContain('PW');

    await render({ ...PRODUCT, name: 'Creatina' });
    expect(el().querySelector('img')).toBeNull();
    expect(text()).toContain('CR');
  });

  it('no muestra costos ni ganancia', async () => {
    await render(PRODUCT, 1);
    expect(text().toLowerCase()).not.toMatch(/costo|ganancia/);
  });
});
