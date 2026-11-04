import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import type { AdminSale } from '../../interfaces/sale.models';
import { AdminSaleSummaryPageComponent } from './admin-sale-summary-page.component';

const REQUEST_ID = '6f1c2a4e-1b3d-4c5e-8f70-123456789abc';
const URL = `${API_BASE_URL}/api/sales/${REQUEST_ID}`;
const SALE: AdminSale = {
  id: 31,
  requestId: REQUEST_ID,
  soldAt: '2026-11-03T18:20:11.512Z',
  soldById: 'a-1',
  holder: null,
  lines: [
    {
      productId: 3,
      name: 'Proteína Demo Whey',
      image: null,
      qty: 2,
      unitPrice: '920.00',
      subtotal: '1840.00',
      unitCost: '610.5000',
      profit: '619.00',
      stock: { before: 4, after: 2 },
    },
  ],
  total: '1840.00',
  profit: '619.00',
};

describe('AdminSaleSummaryPageComponent', () => {
  let fixture: ComponentFixture<AdminSaleSummaryPageComponent>;
  let httpMock: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  function create(query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [AdminSaleSummaryPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ requestId: REQUEST_ID }), queryParamMap: convertToParamMap(query) },
          },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminSaleSummaryPageComponent);
    fixture.detectChanges();
  }

  afterEach(() => httpMock.verify());

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function loaded(sale: AdminSale = SALE, query: Record<string, string> = {}) {
    create(query);
    httpMock.expectOne(URL).flush({ sale, replayed: false });
    await settle();
  }

  it('pide GET /api/sales/<requestId> y mientras carga muestra el aviso', () => {
    create();
    expect(el().querySelector('.loading')).not.toBeNull();
    expect(httpMock.expectOne(URL).request.method).toBe('GET');
  });

  it('muestra el desglose con la ganancia por renglón, el total y la ganancia de la venta', async () => {
    await loaded();
    expect(text('h1')).toBe('Venta confirmada');
    expect(text('.holder')).toBe('Vendido de: Bodega');
    expect(el().querySelectorAll('app-admin-sale-line')).toHaveLength(1);
    expect(text('.stock-change')).toBe('Bodega: 4 → 2');
    expect(text('app-admin-sale-line .profit')).toBe('Ganancia $619.00');
    expect(text('.total')).toBe('$1,840.00');
    expect(text('.profit-summary .profit')).toBe('$619.00');
  });

  it('muestra cuántos productos y piezas fueron y la fecha con hora', async () => {
    await loaded();
    expect(text('.counts')).toBe('1 producto · 2 piezas');
    expect(text('.sold-at')).toMatch(/^\d{2}\/\d{2}\/\d{4} · \d{1,2}:\d{2} (AM|PM)$/);
  });

  it('los renglones van en una cuadrícula con scroll propio y el panel de totales a un lado', async () => {
    await loaded();
    expect(el().querySelector('ul.lines')?.className).toContain('grid');
    expect(el().querySelector('ul.lines')?.className).toContain('overflow-y-auto');
    expect(el().querySelector('aside .total')).not.toBeNull();
    expect(el().querySelector('aside a.new-sale')).not.toBeNull();
  });

  it('con un vendedor dice su nombre y «Luis: 6 → 4»', async () => {
    await loaded({
      ...SALE,
      holder: { id: 'v-1', fullName: 'Luis Vendedor' },
      lines: [{ ...SALE.lines[0]!, stock: { before: 6, after: 4 } }],
    });
    expect(text('.holder')).toBe('Vendido de: Luis Vendedor');
    expect(text('.stock-change')).toBe('Luis: 6 → 4');
  });

  it('«Nueva venta» lleva a /admin/productos y «Ver stock general» a /admin/stock', async () => {
    await loaded();
    expect(el().querySelector('a.new-sale')?.getAttribute('href')).toBe('/admin/productos');
    expect(el().querySelector('a.view-stock')?.getAttribute('href')).toBe('/admin/stock');
    expect(text('a.view-stock')).toBe('Ver stock general');
  });

  it('con ?repetida=1 avisa que la venta ya estaba registrada; sin él no', async () => {
    await loaded(SALE, { repetida: '1' });
    expect(el().querySelector('.replayed')).not.toBeNull();
  });

  it('sin ?repetida no muestra el aviso', async () => {
    await loaded();
    expect(el().querySelector('.replayed')).toBeNull();
  });

  it.each([404, 422])('un %i muestra «No encontramos esta venta» con «Ir a Productos»', async (status) => {
    create();
    httpMock.expectOne(URL).flush({ error: { code: 'x', message: 'no' } }, { status, statusText: 'x' });
    await settle();
    expect(text('.not-found h1')).toBe('No encontramos esta venta');
    expect(el().querySelector('a.go-sell')?.getAttribute('href')).toBe('/admin/productos');
  });

  it('un error de red muestra el aviso y «Reintentar» vuelve a pedir la venta', async () => {
    create();
    httpMock.expectOne(URL).error(new ProgressEvent('error'));
    await settle();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar la venta');
    (el().querySelector('.retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne(URL).flush({ sale: SALE, replayed: false });
    await settle();
    expect(el().querySelectorAll('app-admin-sale-line')).toHaveLength(1);
  });
});
