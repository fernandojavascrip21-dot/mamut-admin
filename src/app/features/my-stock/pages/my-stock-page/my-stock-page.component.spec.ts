import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import type { MyStock } from '../../interfaces/my-stock.models';
import { MyStockPageComponent } from './my-stock-page.component';

const URL = `${API_BASE_URL}/api/me/stock`;

const STOCK: MyStock = {
  total: 8,
  products: [
    { productId: 1, name: 'Creatina', image: null, units: 2, price: '350.00' },
    { productId: 2, name: 'Proteína Whey', image: null, units: 6, price: '500.00' },
  ],
};

describe('MyStockPageComponent', () => {
  let fixture: ComponentFixture<MyStockPageComponent>;
  let httpMock: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyStockPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(MyStockPageComponent);
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

  async function load(stock: MyStock = STOCK) {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(stock);
    await settle();
  }

  function search(query: string) {
    const input = el().querySelector('#my-stock-search') as HTMLInputElement;
    input.value = query;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('mientras carga muestra el aviso y los esqueletos', () => {
    fixture.detectChanges();
    expect(el().querySelector('[role="status"]')?.textContent).toContain('Cargando tu stock…');
    expect(el().querySelectorAll('app-my-stock-card-skeleton')).toHaveLength(3);
    httpMock.expectOne(URL);
  });

  it('con productos muestra el total y una card por producto', async () => {
    await load();
    expect(text('.total')).toBe('Tengo 8 piezas');
    expect(el().querySelectorAll('app-my-stock-card')).toHaveLength(2);
    expect(el().querySelector('.products')?.textContent).toContain('Me quedan 6');
  });

  it('con una sola pieza el total dice «1 pieza»', async () => {
    await load({ total: 1, products: [{ productId: 1, name: 'Creatina', image: null, units: 1, price: '350.00' }] });
    expect(text('.total')).toBe('Tengo 1 pieza');
  });

  it('«Vender» enlaza a /vendedor/vender', async () => {
    await load();
    expect(el().querySelector('a.sell')?.getAttribute('href')).toBe('/vendedor/vender');
  });

  it('sin productos muestra el estado vacío, sin buscador, y «Vender» sigue ahí', async () => {
    await load({ total: 0, products: [] });
    expect(text('.empty')).toContain('Aún no te han dejado producto');
    expect(text('.empty')).toContain('Cuando el administrador te deje piezas, las verás aquí.');
    expect(text('.total')).toBe('Tengo 0 piezas');
    expect(el().querySelector('#my-stock-search')).toBeNull();
    expect(el().querySelector('a.sell')).not.toBeNull();
  });

  it('con error muestra el aviso y «Reintentar» vuelve a pedir el stock', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush({}, { status: 500, statusText: 'Error' });
    await settle();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar tu stock');
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Revisa tu conexión e inténtalo de nuevo.');

    (el().querySelector('.retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(STOCK);
    await settle();
    expect(el().querySelectorAll('app-my-stock-card')).toHaveLength(2);
  });

  describe('buscador', () => {
    it('filtra por nombre sin acentos ni mayúsculas y deja igual el total', async () => {
      await load();
      search('PROTEINA');
      expect(el().querySelectorAll('app-my-stock-card')).toHaveLength(1);
      expect(el().querySelector('.products')?.textContent).toContain('Proteína Whey');
      expect(text('.total')).toBe('Tengo 8 piezas');
    });

    it('sin resultados muestra «No hay productos con ese nombre» y «Limpiar búsqueda» la vacía', async () => {
      await load();
      search('xyz');
      expect(text('.no-match')).toContain('No hay productos con ese nombre');
      expect(el().querySelectorAll('app-my-stock-card')).toHaveLength(0);

      (el().querySelector('.no-match button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el().querySelectorAll('app-my-stock-card')).toHaveLength(2);
    });
  });
});
