import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import type { AuthContext } from '@core/auth/interfaces/auth.models';
import { CartService } from '@core/cart/cart.service';
import { ConfirmService } from '@core/confirm/confirm.service';
import type { SaleCatalog } from '@core/sale-catalog/sale-catalog.models';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import type { Sale } from '../../interfaces/sale.models';
import { AdminCartPageComponent } from './admin-cart-page.component';

const CATALOG_URL = `${API_BASE_URL}/api/sales/catalog`;
const SALES_URL = `${API_BASE_URL}/api/sales`;
const ADMIN: AuthContext = { userId: 'a-1', role: 'admin', clientId: null, fullName: 'Ana' };
const LUIS_ID = '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b';
const REQUEST_ID = '6f1c2a4e-1b3d-4c5e-8f70-123456789abc';

const WAREHOUSE: SaleCatalog = {
  holder: null,
  products: [
    { productId: 1, name: 'Creatina', image: null, units: 4, price: '450.50', unitCost: '200.2500' },
    { productId: 2, name: 'Proteína Whey', image: null, units: 6, price: '750.00', unitCost: '500.1234' },
    { productId: 3, name: 'Isolate', image: null, units: 0, price: '1650.00', unitCost: '900.0000' },
  ],
};
const LUIS: SaleCatalog = {
  holder: { id: LUIS_ID, fullName: 'Luis Vendedor' },
  products: [{ productId: 1, name: 'Creatina', image: null, units: 2, price: '500.00', unitCost: '310.1234' }],
};

describe('AdminCartPageComponent', () => {
  let fixture: ComponentFixture<AdminCartPageComponent>;
  let httpMock: HttpTestingController;
  let cart: CartService;
  let ask: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const lines = () => Array.from(el().querySelectorAll('app-cart-line')) as HTMLElement[];
  const button = () => el().querySelector('button.confirm') as HTMLButtonElement;
  const conflict = (message: string) => ({ error: { code: 'conflict', message } });
  const sale = { id: 31, requestId: REQUEST_ID } as Sale;

  // Crea la página con el carrito ya guardado (v3), como cuando el administrador regresa o recarga.
  function create(stored: { productId: number; units: number }[] = [], holderId: string | null = null) {
    ask = vi.fn().mockResolvedValue(true);
    localStorage.setItem('mamut.user', JSON.stringify(ADMIN));
    if (stored.length > 0) {
      localStorage.setItem(
        'mamut.cart.a-1',
        JSON.stringify({ version: 3, lines: stored, requestId: REQUEST_ID, holderId }),
      );
    }
    TestBed.configureTestingModule({
      imports: [AdminCartPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ConfirmService, useValue: { ask } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    httpMock = TestBed.inject(HttpTestingController);
    cart = TestBed.inject(CartService);
    TestBed.tick();
    fixture = TestBed.createComponent(AdminCartPageComponent);
  }

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // Responde el catálogo del titular del carrito (la bodega no manda `holderId`).
  async function load(catalog: SaleCatalog = WAREHOUSE, holderId: string | null = null) {
    fixture.detectChanges();
    const req = httpMock.expectOne((r) => r.url === CATALOG_URL);
    expect(req.request.params.get('holderId')).toBe(holderId);
    req.flush(catalog);
    await settle();
  }

  it('con el carrito vacío muestra el estado vacío con «Ir a Productos» y no pide el catálogo', async () => {
    create();
    fixture.detectChanges();
    await settle();
    expect(text('.empty')).toContain('Tu carrito está vacío');
    expect(text('.empty')).toContain('Toca «Vender» en los productos para agregarlos.');
    expect(text('a.go-sell')).toBe('Ir a productos');
    expect(el().querySelector('a.go-sell')?.getAttribute('href')).toBe('/admin/productos');
    httpMock.expectNone((r) => r.url === CATALOG_URL);
  });

  it('lee el catálogo del titular del carrito, no el de «Viendo»', async () => {
    create([{ productId: 1, units: 1 }], LUIS_ID);
    await load(LUIS, LUIS_ID);
    expect(text('.holder')).toBe('Vendiendo de: Luis Vendedor');
    expect(lines()[0].querySelector('.unit-price')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('$500.00 c/u');
  });

  it('con la bodega dice «Vendiendo de: Bodega»', async () => {
    create([{ productId: 1, units: 1 }]);
    await load();
    expect(text('.holder')).toBe('Vendiendo de: Bodega');
  });

  it('con error muestra el aviso y «Reintentar» vuelve a pedir el catálogo', async () => {
    create([{ productId: 1, units: 1 }]);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === CATALOG_URL).flush({}, { status: 500, statusText: 'Error' });
    await settle();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar el stock');
    (el().querySelector('.retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === CATALOG_URL).flush(WAREHOUSE);
    await settle();
    expect(lines()).toHaveLength(1);
  });

  it('muestra renglones con subtotal, el total y la ganancia con costos de 4 decimales', async () => {
    // Creatina 2 × (450.50 − 200.2500) = 500.5000; Proteína 1 × (750.00 − 500.1234) = 249.8766 → 750.3766 → 750.38
    create([{ productId: 1, units: 2 }, { productId: 2, units: 1 }]);
    await load();
    expect(lines()[0].querySelector('.subtotal')?.textContent?.trim()).toBe('$901.00');
    expect(text('.pieces')).toBe('3 piezas');
    expect(text('.total')).toBe('$1,651.00');
    expect(text('.profit')).toBe('$750.38');
    expect(text('.profit-summary')).toContain('Ganancia de esta venta');
  });

  it('el panel resume lo que suma el total: nombre, piezas y subtotal por producto', async () => {
    create([{ productId: 1, units: 2 }, { productId: 2, units: 1 }]);
    await load();
    const items = Array.from(el().querySelectorAll('.summary-line')).map((li) =>
      li.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(items).toEqual(['Creatina ×2 $901.00', 'Proteína Whey $750.00']);
    expect(text('.sale-summary h2')).toBe('Resumen de la venta');
  });

  it('el resumen no incluye los renglones de más ni los agotados, igual que el total', async () => {
    create([{ productId: 1, units: 9 }, { productId: 2, units: 1 }, { productId: 3, units: 1 }]);
    await load();
    expect(Array.from(el().querySelectorAll('.summary-line'))).toHaveLength(1);
    expect(text('.summary-line')).toBe('Proteína Whey $750.00');
  });

  it('cambiar piezas actualiza total y ganancia, con tope en lo que tiene el titular', async () => {
    create([{ productId: 1, units: 1 }], LUIS_ID);
    await load(LUIS, LUIS_ID);
    (lines()[0].querySelector('.increment') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(cart.unitsOf(1)).toBe(2);
    expect((lines()[0].querySelector('.increment') as HTMLButtonElement).disabled).toBe(true);
    expect(text('.total')).toBe('$1,000.00');
    expect(text('.profit')).toBe('$379.75');
  });

  it('un renglón de más no suma al total ni a la ganancia y bloquea «Confirmar venta»', async () => {
    create([{ productId: 1, units: 9 }, { productId: 2, units: 1 }]);
    await load();
    expect(lines()[0].querySelector('.warning')?.textContent?.trim()).toBe('Solo te quedan 4 de este producto');
    expect(text('.total')).toBe('$750.00');
    expect(text('.profit')).toBe('$249.88');
    expect(button().disabled).toBe(true);
  });

  describe('confirmar la venta', () => {
    it('abre el diálogo con piezas y total, y no envía si se cancela', async () => {
      create([{ productId: 1, units: 2 }]);
      await load();
      ask.mockResolvedValue(false);
      button().click();
      await settle();
      expect(ask).toHaveBeenCalledWith(
        expect.objectContaining({ title: '¿Confirmar venta?', message: '2 piezas por $901.00.' }),
      );
      httpMock.expectNone(SALES_URL);
      expect(button().disabled).toBe(false);
    });

    it('con la bodega manda holderId null y la llave guardada; en éxito vacía, avisa y abre la venta', async () => {
      create([{ productId: 1, units: 2 }]);
      await load();
      const notify = vi.spyOn(TestBed.inject(StockChangesService), 'notify');
      button().click();
      await settle();
      const req = httpMock.expectOne(SALES_URL);
      expect(req.request.body).toEqual({ requestId: REQUEST_ID, holderId: null, lines: [{ productId: 1, qty: 2 }] });
      req.flush({ sale, replayed: false }, { status: 201, statusText: 'Created' });
      await settle();
      expect(cart.lines()).toEqual([]);
      expect(cart.holderId()).toBeNull();
      expect(notify).toHaveBeenCalledOnce();
      expect(navigate).toHaveBeenCalledWith(['/admin/venta', REQUEST_ID]);
    });

    it('con un vendedor manda su holderId', async () => {
      create([{ productId: 1, units: 1 }], LUIS_ID);
      await load(LUIS, LUIS_ID);
      button().click();
      await settle();
      const req = httpMock.expectOne(SALES_URL);
      expect(req.request.body.holderId).toBe(LUIS_ID);
      req.flush({ sale, replayed: false });
      await settle();
    });

    it('dos toques seguidos: un diálogo, una petición y el botón dice «Confirmando…»', async () => {
      create([{ productId: 1, units: 2 }]);
      await load();
      button().click();
      button().click();
      fixture.detectChanges();
      expect(button().textContent?.trim()).toBe('Confirmando…');
      await settle();
      expect(ask).toHaveBeenCalledTimes(1);
      httpMock.expectOne(SALES_URL).flush({ sale, replayed: false });
      await settle();
    });

    it('sin conexión muestra la alerta y «Reintentar» reenvía la misma llave sin diálogo', async () => {
      create([{ productId: 1, units: 2 }]);
      await load();
      button().click();
      await settle();
      httpMock.expectOne(SALES_URL).error(new ProgressEvent('error'));
      await settle();
      expect(text('.confirm-error')).toContain('No hay conexión');
      expect(cart.lines()).toHaveLength(1);
      (el().querySelector('.retry-send') as HTMLButtonElement).click();
      await settle();
      expect(ask).toHaveBeenCalledTimes(1);
      const req = httpMock.expectOne(SALES_URL);
      expect(req.request.body.requestId).toBe(REQUEST_ID);
      req.flush({ sale, replayed: true });
      await settle();
      expect(navigate).toHaveBeenCalledWith(['/admin/venta', REQUEST_ID]);
    });

    it('«No hay piezas suficientes»: alerta, recarga el catálogo, marca el renglón y conserva el carrito', async () => {
      create([{ productId: 1, units: 2 }], LUIS_ID);
      await load(LUIS, LUIS_ID);
      button().click();
      await settle();
      httpMock.expectOne(SALES_URL).flush(conflict('No hay piezas suficientes'), { status: 409, statusText: 'Conflict' });
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
      expect(text('.confirm-error')).toContain('No hay piezas suficientes');
      httpMock
        .expectOne((r) => r.url === CATALOG_URL)
        .flush({ ...LUIS, products: [{ ...LUIS.products[0]!, units: 1 }] });
      await settle();
      expect(lines()[0].querySelector('.warning')?.textContent?.trim()).toBe('Solo te queda 1 de este producto');
      expect(button().disabled).toBe(true);
      expect(cart.lines()).toEqual([{ productId: 1, units: 2 }]);
    });

    it('un 422 muestra el mensaje del backend', async () => {
      create([{ productId: 1, units: 2 }]);
      await load();
      button().click();
      await settle();
      httpMock.expectOne(SALES_URL).flush(conflict('Producto inexistente'), { status: 422, statusText: 'Unprocessable' });
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
      expect(text('.confirm-error')).toContain('Producto inexistente');
      httpMock.expectOne((r) => r.url === CATALOG_URL).flush(WAREHOUSE);
      await settle();
    });

    it('«ya se registró con otros datos»: vacía el carrito, avisa y abre esa venta con ?repetida=1', async () => {
      create([{ productId: 1, units: 2 }]);
      await load();
      button().click();
      await settle();
      httpMock
        .expectOne(SALES_URL)
        .flush(conflict('Esta venta ya se registró con otros datos.'), { status: 409, statusText: 'Conflict' });
      await settle();
      expect(cart.lines()).toEqual([]);
      expect(navigate).toHaveBeenCalledWith(['/admin/venta', REQUEST_ID], { queryParams: { repetida: 1 } });
    });
  });
});
