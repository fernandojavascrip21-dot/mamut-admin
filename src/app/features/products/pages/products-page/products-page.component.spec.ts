import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ProductsPageComponent } from './products-page.component';
import { API_BASE_URL } from '@core/api-base-url';
import { CartService } from '@core/cart/cart.service';
import { ConfirmService } from '@core/confirm/confirm.service';
import type { SaleCatalog } from '@core/sale-catalog/sale-catalog.models';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ViewingService } from '@core/viewing/viewing.service';
import type { ProductSummary } from '../../interfaces/product.models';

const PRODUCTS_URL = `${API_BASE_URL}/api/products`;
const SELLERS_URL = `${API_BASE_URL}/api/sellers`;
const CATALOG_URL = `${API_BASE_URL}/api/sales/catalog`;
const LUIS_ID = '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b';

const PRODUCTS: ProductSummary[] = [
  { id: 1, name: 'CBUM Thavage', categoryId: null, price: '450.00', stock: 10, fractionable: false, image: '' },
  { id: 2, name: 'Creatina', categoryId: null, price: '300.00', stock: 0, fractionable: true, image: '' },
];

describe('ProductsPageComponent', () => {
  let fixture: ComponentFixture<ProductsPageComponent>;
  let httpMock: HttpTestingController;
  const ask = vi.fn<(options: { title: string; message: string }) => Promise<boolean>>();

  beforeEach(async () => {
    ask.mockReset();
    await TestBed.configureTestingModule({
      imports: [ProductsPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ConfirmService, useValue: { ask } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductsPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // rxResource aplica la respuesta en una microtarea: hay que esperar antes de volver a pintar.
  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function load(products: ProductSummary[]) {
    fixture.detectChanges();
    httpMock.expectOne(PRODUCTS_URL).flush(products);
    await settle();
  }

  function search(text: string) {
    const input = fixture.nativeElement.querySelector('#product-search') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('mientras carga muestra "Cargando productos…" y tarjetas esqueleto', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando productos…');
    expect(fixture.nativeElement.querySelectorAll('app-product-card-skeleton')).toHaveLength(3);
    httpMock.expectOne(PRODUCTS_URL).flush(PRODUCTS);
  });

  it('pinta una tarjeta por producto', async () => {
    await load(PRODUCTS);

    expect(fixture.nativeElement.querySelectorAll('app-product-card')).toHaveLength(2);
  });

  it('con 0 productos muestra el estado vacío con el botón de alta', async () => {
    await load([]);

    expect(fixture.nativeElement.textContent).toContain('Aún no tienes productos');
    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.some((a) => a.textContent?.includes('Dar de alta mi primer producto'))).toBe(true);
    expect(fixture.nativeElement.querySelector('#product-search')).toBeNull();
  });

  it('filtrar con "CBUM" y con "cbúm" deja solo el que coincide, sin importar mayúsculas ni acentos', async () => {
    await load(PRODUCTS);

    search('CBUM');
    expect(fixture.nativeElement.querySelectorAll('app-product-card')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('CBUM Thavage');
    expect(fixture.nativeElement.textContent).not.toContain('Creatina');

    search('cbúm');
    expect(fixture.nativeElement.querySelectorAll('app-product-card')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('CBUM Thavage');
  });

  it('sin coincidencias muestra el aviso y "Limpiar búsqueda" restaura la lista completa', async () => {
    await load(PRODUCTS);

    search('no existe');
    expect(fixture.nativeElement.textContent).toContain('No hay productos con ese nombre');
    expect(fixture.nativeElement.querySelectorAll('app-product-card')).toHaveLength(0);

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#product-search').value).toBe('');
    expect(fixture.nativeElement.querySelectorAll('app-product-card')).toHaveLength(2);
  });

  it('si la petición falla muestra "Reintentar", y al tocarlo vuelve a pedir la lista', async () => {
    fixture.detectChanges();
    httpMock.expectOne(PRODUCTS_URL).error(new ProgressEvent('error'));
    await settle();

    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar los productos');

    (fixture.nativeElement.querySelector('.retry') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cargando productos…');
    httpMock.expectOne(PRODUCTS_URL).flush(PRODUCTS);
    await settle();

    expect(fixture.nativeElement.querySelectorAll('app-product-card')).toHaveLength(2);
  });
  describe('cambios de inventario (spec T-16)', () => {
    it('al avisarse un cambio vuelve a pedir la lista sin mostrar «cargando» y pinta las piezas nuevas', async () => {
      await load(PRODUCTS);
      TestBed.inject(StockChangesService).notify();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('app-product-card')).toHaveLength(2);
      expect(fixture.nativeElement.querySelector('app-product-card-skeleton')).toBeNull();
      httpMock.expectOne(PRODUCTS_URL).flush([{ ...PRODUCTS[0]!, stock: 8 }, PRODUCTS[1]!]);
      await settle();
      expect(fixture.nativeElement.textContent).toContain('8');
    });

    it('una versión que ya existía al crearse la página no vuelve a pedir la lista', async () => {
      TestBed.inject(StockChangesService).notify();
      await load(PRODUCTS);
      httpMock.expectNone(PRODUCTS_URL);
    });
  });

  describe('Vender como administrador (HU-17)', () => {
    const WAREHOUSE_CATALOG: SaleCatalog = {
      holder: null,
      products: [
        { productId: 1, name: 'CBUM Thavage', image: null, units: 3, price: '450.00', unitCost: '200.0000' },
        { productId: 2, name: 'Creatina', image: null, units: 0, price: '300.00', unitCost: '120.0000' },
      ],
    };
    const LUIS_CATALOG: SaleCatalog = {
      holder: { id: LUIS_ID, fullName: 'Luis Vendedor' },
      products: [
        { productId: 1, name: 'CBUM Thavage', image: null, units: 6, price: '500.00', unitCost: '310.1234' },
        { productId: 2, name: 'Creatina', image: null, units: 0, price: '350.00', unitCost: '120.0000' },
      ],
    };
    let cart: CartService;
    let viewing: ViewingService;

    beforeEach(() => {
      localStorage.setItem('mamut.user', JSON.stringify({ userId: 'a1', role: 'admin', clientId: null, fullName: 'Ana' }));
      cart = TestBed.inject(CartService);
      viewing = TestBed.inject(ViewingService);
      TestBed.tick();
    });

    afterEach(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Carga la lista de vendedores (el shell lo hace en la app), la de productos y el catálogo del titular.
    async function loadWith(catalog: SaleCatalog, holderId: string | null = null) {
      if (holderId) viewing.select(holderId);
      viewing.load();
      httpMock.expectOne(SELLERS_URL).flush([{ id: LUIS_ID, fullName: 'Luis Vendedor' }]);
      fixture.detectChanges();
      httpMock.expectOne(PRODUCTS_URL).flush(PRODUCTS);
      const req = httpMock.expectOne((r) => r.url === CATALOG_URL);
      expect(req.request.params.get('holderId')).toBe(holderId);
      req.flush(catalog);
      await settle();
    }

    const card = (index: number) => fixture.nativeElement.querySelectorAll('app-product-card')[index] as HTMLElement;
    const click = (selector: string, from: HTMLElement = fixture.nativeElement) => {
      (from.querySelector(selector) as HTMLButtonElement).click();
    };

    it('no pide el catálogo mientras carga la lista de vendedores', () => {
      fixture.detectChanges();
      httpMock.expectOne(PRODUCTS_URL).flush(PRODUCTS);
      httpMock.expectNone((r) => r.url === CATALOG_URL);
    });

    it('con «Yo · bodega» pide el catálogo sin holderId y ofrece «Vender» solo con piezas', async () => {
      await loadWith(WAREHOUSE_CATALOG);
      expect(card(0).querySelector('button.sell')).not.toBeNull();
      expect(card(1).querySelector('button.sell')).toBeNull();
      expect(card(0).querySelector('.holder-units')).toBeNull();
    });

    it('el primer «Vender» agrega 1 pieza y el botón se vuelve − N + con tope en las piezas', async () => {
      await loadWith(WAREHOUSE_CATALOG);
      click('button.sell', card(0));
      await settle();
      expect(cart.lines()).toEqual([{ productId: 1, units: 1 }]);
      expect(cart.holderId()).toBeNull();
      expect(card(0).querySelector('.units')!.textContent).toBe('1');

      click('button.increment', card(0));
      click('button.increment', card(0));
      fixture.detectChanges();
      expect(cart.unitsOf(1)).toBe(3);
      expect((card(0).querySelector('button.increment') as HTMLButtonElement).disabled).toBe(true);
      click('button.increment', card(0));
      expect(cart.unitsOf(1)).toBe(3);
    });

    it('«−» con 1 pieza quita el producto', async () => {
      await loadWith(WAREHOUSE_CATALOG);
      click('button.sell', card(0));
      await settle();
      click('button.decrement', card(0));
      fixture.detectChanges();
      expect(cart.lines()).toEqual([]);
      expect(card(0).querySelector('button.sell')).not.toBeNull();
    });

    it('con un vendedor en «Viendo» pide su catálogo, muestra «Luis: N» y el tope es lo que tiene', async () => {
      await loadWith(LUIS_CATALOG, LUIS_ID);
      expect(card(0).querySelector('.holder-units')!.textContent!.trim()).toBe('Luis: 6');
      expect(card(1).querySelector('.holder-units')!.textContent!.trim()).toBe('Luis: 0');
      expect(card(1).querySelector('button.sell')).toBeNull();
      click('button.sell', card(0));
      await settle();
      expect(cart.holderId()).toBe(LUIS_ID);
    });

    it('la barra del carrito aparece con piezas, con el total del catálogo, y enlaza a /admin/carrito', async () => {
      await loadWith(WAREHOUSE_CATALOG);
      expect(fixture.nativeElement.querySelector('app-cart-bar')).toBeNull();
      click('button.sell', card(0));
      await settle();
      click('button.increment', card(0));
      await settle();
      const bar = fixture.nativeElement.querySelector('app-cart-bar') as HTMLElement;
      expect(bar.querySelector('.summary')!.textContent!.trim()).toBe('Carrito · 2 piezas');
      expect(bar.querySelector('.total')!.textContent!.trim()).toBe('$900.00');
      expect(bar.querySelector('a.view-cart')!.getAttribute('href')).toBe('/admin/carrito');
    });

    describe('con un carrito de otro titular', () => {
      beforeEach(async () => {
        cart.assignHolder(LUIS_ID);
        cart.setUnits(1, 2);
        await loadWith(WAREHOUSE_CATALOG);
      });

      it('las tarjetas no pintan sus piezas ni se muestra la barra', () => {
        expect(card(0).querySelector('button.sell')).not.toBeNull();
        expect(card(0).querySelector('.stepper')).toBeNull();
        expect(fixture.nativeElement.querySelector('app-cart-bar')).toBeNull();
      });

      it('«Vender» pregunta «¿Vaciar el carrito?»; cancelar no cambia nada', async () => {
        ask.mockResolvedValue(false);
        click('button.sell', card(0));
        await settle();
        expect(ask.mock.calls[0]![0]).toMatchObject({
          title: '¿Vaciar el carrito?',
          message: 'Tu carrito es de Luis Vendedor. Si cambias a la bodega, se vacía.',
        });
        expect(cart.holderId()).toBe(LUIS_ID);
        expect(cart.unitsOf(1)).toBe(2);
      });

      it('aceptar vacía el carrito y agrega con el titular nuevo', async () => {
        ask.mockResolvedValue(true);
        click('button.sell', card(0));
        await settle();
        expect(cart.holderId()).toBeNull();
        expect(cart.lines()).toEqual([{ productId: 1, units: 1 }]);
      });
    });

    it('al avisarse un cambio de inventario vuelve a pedir también el catálogo', async () => {
      await loadWith(WAREHOUSE_CATALOG);
      TestBed.inject(StockChangesService).notify();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCTS_URL).flush(PRODUCTS);
      httpMock.expectOne((r) => r.url === CATALOG_URL).flush(WAREHOUSE_CATALOG);
      await settle();
    });
  });
});
