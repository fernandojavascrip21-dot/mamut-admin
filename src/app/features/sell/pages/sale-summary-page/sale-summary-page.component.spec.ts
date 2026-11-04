import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import type { Sale } from '../../interfaces/sale.models';
import { SaleSummaryPageComponent } from './sale-summary-page.component';

const REQUEST_ID = '6f1c2a4e-1b3d-4c5e-8f70-123456789abc';
const URL = `${API_BASE_URL}/api/sales/${REQUEST_ID}`;
const SALE: Sale = {
  id: 31,
  requestId: REQUEST_ID,
  soldAt: '2026-11-03T18:20:11.512Z',
  soldById: 'v-1',
  holder: { id: 'v-1', fullName: 'Víctor Demo' },
  lines: [
    {
      productId: 3,
      name: 'Proteína Demo Whey',
      image: null,
      qty: 2,
      unitPrice: '920.00',
      subtotal: '1840.00',
      stock: { before: 6, after: 4 },
    },
  ],
  total: '1840.00',
};

describe('SaleSummaryPageComponent', () => {
  let fixture: ComponentFixture<SaleSummaryPageComponent>;
  let httpMock: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  function create(query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [SaleSummaryPageComponent],
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
    fixture = TestBed.createComponent(SaleSummaryPageComponent);
    fixture.detectChanges();
  }

  afterEach(() => httpMock.verify());

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('pide GET /api/sales/<requestId> y mientras carga muestra el aviso', () => {
    create();
    expect(el().querySelector('.loading')).not.toBeNull();
    expect(httpMock.expectOne(URL).request.method).toBe('GET');
  });

  it('muestra el desglose, el total y los enlaces «Nueva venta» y «Ver mi stock»', async () => {
    create();
    httpMock.expectOne(URL).flush({ sale: SALE, replayed: false });
    await settle();
    expect(text('h1')).toBe('Venta confirmada');
    expect(el().querySelectorAll('app-sale-line')).toHaveLength(1);
    expect(text('.total')).toBe('$1,840.00');
    expect(el().querySelector('a.new-sale')?.getAttribute('href')).toBe('/vendedor/vender');
    expect(el().querySelector('a.view-stock')?.getAttribute('href')).toBe('/vendedor/mi-stock');
    expect(el().querySelector('.replayed')).toBeNull();
    expect(el().querySelector('.seal')).not.toBeNull();
    expect(text('.sold-at')).toMatch(/\d{1,2}:\d{2}/);
    expect(el().querySelectorAll('a.new-sale, a.view-stock').length).toBe(2);
    expect(el().textContent!.toLowerCase()).not.toMatch(/costo|ganancia|anular/);
  });

  it('con ?repetida=1 muestra el aviso de venta repetida', async () => {
    create({ repetida: '1' });
    httpMock.expectOne(URL).flush({ sale: SALE, replayed: true });
    await settle();
    expect(text('.replayed')).toBe('Esta venta ya se había registrado. Esto es lo que se vendió.');
  });

  it.each([404, 422])('un %i muestra «No encontramos esta venta» con «Ir a vender»', async (status) => {
    create();
    httpMock.expectOne(URL).flush({ error: { code: 'x', message: 'x' } }, { status, statusText: 'Error' });
    await settle();
    expect(text('.not-found h1')).toBe('No encontramos esta venta');
    expect(el().querySelector('a.go-sell')?.getAttribute('href')).toBe('/vendedor/vender');
  });

  it('un error de red muestra el aviso y «Reintentar» vuelve a pedir la venta', async () => {
    create();
    httpMock.expectOne(URL).flush({}, { status: 500, statusText: 'Error' });
    await settle();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar tu venta');
    (el().querySelector('.retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne(URL).flush({ sale: SALE, replayed: false });
    await settle();
    expect(el().querySelectorAll('app-sale-line')).toHaveLength(1);
  });
});
