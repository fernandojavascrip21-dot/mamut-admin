import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { CartRow } from '../../models/cart-page.models';
import { CartLineComponent } from './cart-line.component';

const ROW: CartRow = {
  product: { productId: 3, name: 'Proteína Whey', image: null, units: 6, price: '750.00' },
  units: 2,
  available: 6,
  subtotal: '1500.00',
  status: 'ok',
};

describe('CartLineComponent', () => {
  let fixture: ComponentFixture<CartLineComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  const button = (selector: string) => el().querySelector(selector) as HTMLButtonElement | null;

  async function render(row: CartRow) {
    fixture = TestBed.createComponent(CartLineComponent);
    fixture.componentRef.setInput('row', row);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CartLineComponent] }).compileComponents();
  });

  it('muestra el nombre, el precio c/u, las piezas «de N» y el subtotal', async () => {
    await render(ROW);
    expect(text()).toContain('Proteína Whey');
    expect(text()).toContain('$750.00 c/u');
    expect(el().querySelector('.units')!.textContent!.trim()).toBe('2');
    expect(el().querySelector('.available')!.textContent!.trim()).toBe('de 6');
    expect(el().querySelector('.subtotal')!.textContent!.trim()).toBe('$1,500.00');
    expect(el().querySelector('.warning')).toBeNull();
  });

  it('emite increment, decrement y remove, con nombre accesible por producto', async () => {
    await render(ROW);
    const inc = vi.fn();
    const dec = vi.fn();
    const rem = vi.fn();
    fixture.componentInstance.increment.subscribe(inc);
    fixture.componentInstance.decrement.subscribe(dec);
    fixture.componentInstance.remove.subscribe(rem);

    button('.increment')!.click();
    button('.decrement')!.click();
    button('.remove')!.click();
    expect([inc, dec, rem].map((fn) => fn.mock.calls.length)).toEqual([1, 1, 1]);
    expect(button('.increment')!.getAttribute('aria-label')).toBe('Agregar una pieza de Proteína Whey');
    expect(button('.decrement')!.getAttribute('aria-label')).toBe('Quitar una pieza de Proteína Whey');
    expect(button('.remove')!.getAttribute('aria-label')).toBe('Quitar del carrito Proteína Whey');
  });

  it('el + se deshabilita cuando el carrito ya pide todo lo que hay', async () => {
    await render({ ...ROW, units: 6 });
    expect(button('.increment')!.disabled).toBe(true);
    expect(button('.decrement')!.disabled).toBe(false);
  });

  it('con piezas de más avisa «Solo te quedan N de este producto», deja bajar y no sube', async () => {
    await render({
      ...ROW, product: { ...ROW.product, units: 2 }, units: 5, available: 2, subtotal: '3750.00', status: 'over',
    });
    expect(el().querySelector('.warning')!.textContent!.trim()).toBe('Solo te quedan 2 de este producto');
    expect(el().querySelector('.warning')!.getAttribute('role')).toBe('alert');
    expect(button('.increment')!.disabled).toBe(true);
    expect(button('.decrement')!.disabled).toBe(false);
    expect(el().querySelector('.subtotal')).toBeNull();
  });

  it('con una sola pieza disponible dice «Solo te queda 1 de este producto»', async () => {
    await render({ ...ROW, product: { ...ROW.product, units: 1 }, units: 3, available: 1, status: 'over' });
    expect(el().querySelector('.warning')!.textContent!.trim()).toBe('Solo te queda 1 de este producto');
  });

  it('un producto agotado sale «Agotado», sin −/+ ni subtotal, y se puede quitar', async () => {
    await render({
      product: { ...ROW.product, units: 0 }, units: 2, available: 0, subtotal: '1500.00', status: 'soldOut',
    });
    expect(el().querySelector('.warning')!.textContent).toContain('Agotado');
    expect(button('.stepper')).toBeNull();
    expect(button('.increment')).toBeNull();
    expect(el().querySelector('.subtotal')).toBeNull();
    const rem = vi.fn();
    fixture.componentInstance.remove.subscribe(rem);
    button('.remove')!.click();
    expect(rem).toHaveBeenCalledTimes(1);
  });

  it('muestra las iniciales sin foto y cae a ellas si la foto falla', async () => {
    await render({ ...ROW, product: { ...ROW.product, name: 'Creatina' } });
    expect(el().querySelector('img')).toBeNull();
    expect(text()).toContain('CR');

    await render({ ...ROW, product: { ...ROW.product, image: 'https://cdn.test/rota.png' } });
    (el().querySelector('img') as HTMLImageElement).dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el().querySelector('img')).toBeNull();
    expect(text()).toContain('PW');
  });

  it('no muestra costos ni ganancia', async () => {
    await render(ROW);
    expect(text().toLowerCase()).not.toMatch(/costo|ganancia/);
  });
});
