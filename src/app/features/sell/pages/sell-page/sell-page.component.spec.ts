import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import type { AuthContext } from '@core/auth/interfaces/auth.models';
import { CartService } from '@core/cart/cart.service';
import type { SellStock } from '../../interfaces/sell-stock.models';
import { SellPageComponent } from './sell-page.component';

const URL = `${API_BASE_URL}/api/me/stock?includeSoldOut=true`;
const LUIS: AuthContext = { userId: 'v-luis', role: 'vendedor', clientId: null, fullName: 'Luis' };

const STOCK: SellStock = {
  total: 9,
  products: [
    { productId: 1, name: 'Creatina', image: null, units: 3, price: '450.00' },
    { productId: 2, name: 'Proteína Whey', image: null, units: 6, price: '750.00' },
    { productId: 3, name: 'Isolate', image: null, units: 0, price: '1650.00' },
  ],
};

describe('SellPageComponent', () => {
  let fixture: ComponentFixture<SellPageComponent>;
  let httpMock: HttpTestingController;
  let cart: CartService;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const cards = () => Array.from(el().querySelectorAll('app-sell-product-card')) as HTMLElement[];
  const click = (card: HTMLElement, selector: string) => {
    (card.querySelector(selector) as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    localStorage.setItem('mamut.user', JSON.stringify(LUIS));
    await TestBed.configureTestingModule({
      imports: [SellPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    cart = TestBed.inject(CartService);
    TestBed.tick();
    fixture = TestBed.createComponent(SellPageComponent);
  });

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

  function search(query: string) {
    const input = el().querySelector('#sell-search') as HTMLInputElement;
    input.value = query;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('mientras carga muestra el aviso y los esqueletos', () => {
    fixture.detectChanges();
    expect(el().querySelector('[role="status"]')?.textContent).toContain('Cargando tu stock…');
    expect(el().querySelectorAll('app-sell-product-card-skeleton')).toHaveLength(3);
    httpMock.expectOne(URL);
  });

  it('pide el stock con includeSoldOut=true y muestra una card por producto, también el agotado (criterios 1 y 6)', async () => {
    await load();
    expect(cards()).toHaveLength(3);
    expect(cards()[0].textContent).toContain('Quedan 3');
    expect(cards()[2].querySelector('.sold-out')).not.toBeNull();
    expect(cards()[2].querySelector('.add')).toBeNull();
  });

  it('sin productos muestra el estado vacío y no hay buscador', async () => {
    await load({ total: 0, products: [] });
    expect(text('.empty')).toContain('Aún no te han dejado producto');
    expect(text('.empty')).toContain('Pídele al administrador que te deje piezas para vender.');
    expect(el().querySelector('#sell-search')).toBeNull();
  });

  it('con error muestra el aviso y «Reintentar» vuelve a pedir el stock', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush({}, { status: 500, statusText: 'Error' });
    await settle();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar tu stock');

    (el().querySelector('.retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(STOCK);
    await settle();
    expect(cards()).toHaveLength(3);
  });

  describe('buscador', () => {
    it('filtra por nombre sin acentos ni mayúsculas (criterio 2)', async () => {
      await load();
      search('PROTEINA');
      expect(cards()).toHaveLength(1);
      expect(cards()[0].textContent).toContain('Proteína Whey');
    });

    it('no cambia el carrito ni la barra, y «Limpiar búsqueda» la vacía', async () => {
      await load();
      click(cards()[0], '.add');
      search('xyz');
      expect(text('.no-match')).toContain('No hay productos con ese nombre');
      expect(el().querySelector('app-cart-bar')).not.toBeNull();
      expect(cart.totalUnits()).toBe(1);

      (el().querySelector('.no-match button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(cards()).toHaveLength(3);
    });
  });

  describe('carrito', () => {
    it('«+ Agregar» pone 1 pieza en el carrito y la card pasa a −/+ con «Quedan» descontado', async () => {
      await load();
      click(cards()[0], '.add');
      expect(cart.unitsOf(1)).toBe(1);
      expect(cards()[0].querySelector('.units')?.textContent?.trim()).toBe('1');
      expect(cards()[0].textContent).toContain('Quedan 2');
    });

    it('el + sube hasta lo que tiene (3) y ahí se deshabilita (criterio 3)', async () => {
      await load();
      click(cards()[0], '.add');
      click(cards()[0], '.increment');
      click(cards()[0], '.increment');
      expect(cart.unitsOf(1)).toBe(3);
      expect((cards()[0].querySelector('.increment') as HTMLButtonElement).disabled).toBe(true);

      // Aunque algo lo emitiera, el tope lo vuelve a aplicar la página.
      cards()[0].querySelector('app-sell-product-card')?.dispatchEvent(new Event('increment'));
      expect(cart.unitsOf(1)).toBe(3);
    });

    it('el − baja una pieza y con la última quita el producto del carrito', async () => {
      await load();
      click(cards()[0], '.add');
      click(cards()[0], '.increment');
      click(cards()[0], '.decrement');
      expect(cart.unitsOf(1)).toBe(1);
      click(cards()[0], '.decrement');
      expect(cart.unitsOf(1)).toBe(0);
      expect(cards()[0].querySelector('.add')).not.toBeNull();
    });

    it('sin piezas en el carrito no se muestra la barra', async () => {
      await load();
      expect(el().querySelector('app-cart-bar')).toBeNull();
    });

    it('con piezas la barra muestra «Carrito · N piezas», el total exacto y «Ver carrito»', async () => {
      await load();
      click(cards()[0], '.add');
      click(cards()[0], '.increment');
      click(cards()[1], '.add');
      expect(text('app-cart-bar .summary')).toBe('Carrito · 3 piezas');
      expect(text('app-cart-bar .total')).toBe('$1,650.00');
      expect(el().querySelector('app-cart-bar a.view-cart')?.getAttribute('href')).toBe('/vendedor/carrito');
    });

    it('un carrito guardado se ve al entrar: la card ya muestra sus piezas y la barra aparece', async () => {
      cart.setUnits(2, 2);
      await load();
      expect(cards()[1].querySelector('.units')?.textContent?.trim()).toBe('2');
      expect(text('app-cart-bar .summary')).toBe('Carrito · 2 piezas');
    });
  });
});
