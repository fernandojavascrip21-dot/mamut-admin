import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import type { AuthContext } from '@core/auth/interfaces/auth.models';
import { CartService } from '@core/cart/cart.service';
import type { SellStock } from '../../interfaces/sell-stock.models';
import { CartPageComponent } from './cart-page.component';

const URL = `${API_BASE_URL}/api/me/stock?includeSoldOut=true`;
const LUIS: AuthContext = { userId: 'v-luis', role: 'vendedor', clientId: null, fullName: 'Luis' };

const STOCK: SellStock = {
  total: 8,
  products: [
    { productId: 1, name: 'Creatina', image: null, units: 2, price: '450.50' },
    { productId: 2, name: 'Proteína Whey', image: null, units: 6, price: '750.00' },
    { productId: 3, name: 'Isolate', image: null, units: 0, price: '1650.00' },
  ],
};

describe('CartPageComponent', () => {
  let fixture: ComponentFixture<CartPageComponent>;
  let httpMock: HttpTestingController;
  let cart: CartService;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const lines = () => Array.from(el().querySelectorAll('app-cart-line')) as HTMLElement[];
  const click = (line: HTMLElement, selector: string) => {
    (line.querySelector(selector) as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  // Crea la página con el carrito ya guardado, como cuando el vendedor regresa o recarga.
  function create(stored: { productId: number; units: number }[] = []) {
    localStorage.setItem('mamut.user', JSON.stringify(LUIS));
    if (stored.length > 0) {
      localStorage.setItem('mamut.cart.v-luis', JSON.stringify({ version: 1, lines: stored }));
    }
    TestBed.configureTestingModule({
      imports: [CartPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    cart = TestBed.inject(CartService);
    TestBed.tick();
    fixture = TestBed.createComponent(CartPageComponent);
  }

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  // rxResource aplica la respuesta en una microtarea: hay que esperar antes de volver a pintar.
  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function load(stock: SellStock = STOCK) {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(stock);
    await settle();
  }

  it('con el carrito vacío muestra «Tu carrito está vacío» con «Ir a vender» y no pide el stock', async () => {
    create();
    fixture.detectChanges();
    await settle();
    expect(text('.empty')).toContain('Tu carrito está vacío');
    expect(text('.empty')).toContain('Agrega productos desde Vender.');
    expect(el().querySelector('a.go-sell')?.getAttribute('href')).toBe('/vendedor/vender');
    expect(el().querySelector('.pieces')).toBeNull();
    httpMock.expectNone(URL);
  });

  it('mientras carga el stock muestra el aviso y los esqueletos', () => {
    create([{ productId: 1, units: 1 }]);
    fixture.detectChanges();
    expect(el().querySelector('[role="status"]')?.textContent).toContain('Cargando tu stock…');
    expect(el().querySelectorAll('app-sell-product-card-skeleton').length).toBeGreaterThan(0);
    httpMock.expectOne(URL);
  });

  it('con error muestra el aviso y «Reintentar» vuelve a pedir el stock', async () => {
    create([{ productId: 1, units: 1 }]);
    fixture.detectChanges();
    httpMock.expectOne(URL).flush({}, { status: 500, statusText: 'Error' });
    await settle();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar tu stock');

    (el().querySelector('.retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(STOCK);
    await settle();
    expect(lines()).toHaveLength(1);
  });

  it('muestra un renglón por producto con precio, subtotal y el total exacto (criterio 4)', async () => {
    create([{ productId: 1, units: 2 }, { productId: 2, units: 1 }]);
    await load();
    expect(lines()).toHaveLength(2);
    expect(lines()[0].textContent).toContain('Creatina');
    expect(lines()[0].querySelector('.subtotal')?.textContent?.trim()).toBe('$901.00');
    expect(lines()[1].querySelector('.unit-price')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('$750.00 c/u');
    expect(text('.pieces')).toBe('3 piezas');
    expect(text('.total')).toBe('$1,651.00');
    expect(el().querySelector('.fix-hint')).toBeNull();
  });

  it('no muestra «Confirmar venta» ni costos ni ganancia', async () => {
    create([{ productId: 1, units: 1 }]);
    await load();
    const content = el().textContent!.toLowerCase();
    expect(content).not.toContain('confirmar');
    expect(content).not.toMatch(/costo|ganancia/);
  });

  it('«Seguir vendiendo» lleva a /vendedor/vender', async () => {
    create([{ productId: 1, units: 1 }]);
    await load();
    expect(el().querySelector('a.keep-selling')?.getAttribute('href')).toBe('/vendedor/vender');
  });

  describe('cambiar el carrito', () => {
    it('el + sube hasta lo que tiene y ahí se deshabilita; el total se actualiza', async () => {
      create([{ productId: 1, units: 1 }]);
      await load();
      click(lines()[0], '.increment');
      expect(cart.unitsOf(1)).toBe(2);
      expect((lines()[0].querySelector('.increment') as HTMLButtonElement).disabled).toBe(true);
      expect(text('.total')).toBe('$901.00');
    });

    it('el − baja una pieza; con la última quita el renglón y, sin renglones, vuelve al vacío', async () => {
      create([{ productId: 1, units: 2 }]);
      await load();
      click(lines()[0], '.decrement');
      expect(cart.unitsOf(1)).toBe(1);
      click(lines()[0], '.decrement');
      await settle();
      expect(el().querySelector('.empty')).not.toBeNull();
      expect(cart.lines()).toEqual([]);
    });

    it('«Quitar» saca el producto sin confirmar', async () => {
      create([{ productId: 1, units: 1 }, { productId: 2, units: 1 }]);
      await load();
      click(lines()[0], '.remove');
      expect(cart.lines()).toEqual([{ productId: 2, units: 1 }]);
      expect(lines()).toHaveLength(1);
    });
  });

  describe('carrito viejo', () => {
    it('piezas de más: avisa «Solo te quedan N de este producto», no se ajusta solo y no suma al total', async () => {
      create([{ productId: 1, units: 5 }, { productId: 2, units: 1 }]);
      await load();
      expect(lines()[0].querySelector('.warning')?.textContent?.trim()).toBe('Solo te quedan 2 de este producto');
      expect(cart.unitsOf(1)).toBe(5);
      expect(text('.total')).toBe('$750.00');
      expect(el().querySelector('.fix-hint')).not.toBeNull();
    });

    it('bajar con el − corrige el aviso paso a paso', async () => {
      create([{ productId: 1, units: 3 }]);
      await load();
      expect(lines()[0].querySelector('.warning')).not.toBeNull();
      click(lines()[0], '.decrement');
      expect(lines()[0].querySelector('.warning')).toBeNull();
      expect(el().querySelector('.fix-hint')).toBeNull();
      expect(text('.total')).toBe('$901.00');
    });

    it('un producto que se acabó sale «Agotado» con «Quitar», sin −/+', async () => {
      create([{ productId: 3, units: 1 }]);
      await load();
      expect(lines()[0].querySelector('.warning')?.textContent).toContain('Agotado');
      expect(lines()[0].querySelector('.stepper')).toBeNull();
      expect(text('.total')).toBe('$0.00');
      click(lines()[0], '.remove');
      expect(cart.lines()).toEqual([]);
    });

    it('un producto que ya no viene en el stock sale «Agotado» con su nombre de relleno', async () => {
      create([{ productId: 99, units: 2 }]);
      await load();
      expect(lines()[0].textContent).toContain('Producto no disponible');
      expect(lines()[0].querySelector('.warning')?.textContent).toContain('Agotado');
    });
  });
});
