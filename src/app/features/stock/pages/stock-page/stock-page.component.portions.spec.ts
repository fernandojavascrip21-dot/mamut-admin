import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { API_BASE_URL } from '@core/api-base-url';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import type { ViewingSeller } from '@core/viewing/interfaces/viewing.models';
import { ViewingService } from '@core/viewing/viewing.service';
import type { StockOverview, StockProduct } from '../../interfaces/stock-overview.models';
import type { FractionHistoryItem } from '../../interfaces/stock-history.models';
import { StockPageComponent } from './stock-page.component';

const STOCK_URL = `${API_BASE_URL}/api/stock`;
const FRACTIONS_URL = `${API_BASE_URL}/api/fractions`;
const LUIS: ViewingSeller = { id: 'luis-id', fullName: 'Luis' };

const row = (productId: number, name: string, extra: Partial<StockProduct> = {}): StockProduct => ({
  productId, name, image: null, warehouse: 0, warehouseLevel: 'out', sellers: [], inactiveSellers: 0, total: 0, ...extra,
});
const OVERVIEW: StockOverview = {
  warehouse: 13,
  sellers: [{ id: LUIS.id, fullName: 'Luis', units: 3 }],
  inactiveSellers: 0,
  total: 16,
  products: [
    row(1, 'Creatina 300 g', { warehouse: 8, warehouseLevel: 'ok', total: 8, parentProductId: null }),
    row(2, 'Creatina 300 g · bolsita 30 g', {
      warehouse: 5, warehouseLevel: 'ok', total: 8, parentProductId: 1,
      sellers: [{ sellerId: LUIS.id, units: 3, stockLevel: 'ok' }],
    }),
    row(3, 'Proteína Whey · bolsita 40 g', { warehouse: 0, total: 0, parentProductId: 4 }),
  ],
  lowStock: [],
};
const NO_BAGS: StockOverview = { ...OVERVIEW, products: [OVERVIEW.products[0]!] };
const fraction = (id: number, whole: string, bag: string): FractionHistoryItem => ({
  id, requestId: `f-${id}`, createdAt: '2026-11-07T16:00:00Z', portions: 7, wholeUnitCost: '450.0000',
  portionUnitCost: '64.2857', portionPrice: '85.00', product: { id: id * 10, name: whole },
  portionProduct: { id: id * 10 + 1, name: bag }, createdBy: { id: 'a-1', name: 'Ana Admin' },
});
const FRACTIONS = [
  fraction(1, 'Creatina 300 g', 'Creatina 300 g · bolsita 30 g'),
  fraction(2, 'Proteína Whey', 'Proteína Whey · bolsita 40 g'),
];

describe('StockPageComponent · «Fraccionados» con bolsitas por titular (HU-26 §13)', () => {
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;
  let selected: ReturnType<typeof signal<ViewingSeller | null>>;
  const el = () => harness.fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  const lines = (selector: string) => Array.from(el().querySelectorAll(selector));
  const settle = async () => {
    harness.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
  };
  const search = async (value: string) => {
    const input = el().querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const bagRows = () => lines('app-stock-product-row').map((r) => r.textContent!.replace(/\s+/g, ' '));

  async function open(overview: StockOverview = OVERVIEW, url = '/admin/stock?vista=fraccionados', flushFractions = true) {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, StockPageComponent);
    harness.detectChanges();
    httpMock.expectOne(STOCK_URL).flush(overview);
    await settle();
    if (flushFractions) {
      httpMock.expectOne(FRACTIONS_URL).flush({ fractions: FRACTIONS });
      await settle();
    }
  }

  beforeEach(() => {
    selected = signal<ViewingSeller | null>(null);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin/stock', component: StockPageComponent }]),
        { provide: ViewingService, useValue: { selectedSeller: selected.asReadonly() } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  describe('con «Yo · bodega»', () => {
    it('muestra «Bolsitas en stock» y «Últimos fraccionados»', async () => {
      await open();
      expect(text()).toContain('Bolsitas en stock');
      expect(text()).toContain('Últimos fraccionados');
      expect(text().indexOf('Bolsitas en stock')).toBeLessThan(text().indexOf('Últimos fraccionados'));
      expect(lines('app-fraction-history-line')).toHaveLength(2);
    });

    it('lista solo las bolsitas con su reparto por titular, también las del vendedor', async () => {
      await open();
      const rows = bagRows();
      expect(rows).toHaveLength(2);
      expect(rows[0]).toContain('Creatina 300 g · bolsita 30 g');
      expect(rows[0]).toContain('Bodega 5 · Luis 3');
      expect(rows[1]).toContain('Proteína Whey · bolsita 40 g');
      expect(rows.some((r) => r.includes('Creatina 300 g ·') === false && r.startsWith('Creatina 300 g'))).toBe(false);
    });

    it('sin bolsitas dice «No hay bolsitas en stock» y conserva el historial', async () => {
      await open(NO_BAGS);
      expect(text()).toContain('No hay bolsitas en stock');
      expect(lines('app-stock-product-row')).toHaveLength(0);
      expect(lines('app-fraction-history-line')).toHaveLength(2);
    });

    it('el buscador filtra las bolsitas y el historial', async () => {
      await open();
      await search('proteina');
      expect(lines('app-stock-product-row')).toHaveLength(1);
      expect(bagRows()[0]).toContain('Proteína Whey');
      expect(lines('app-fraction-history-line')).toHaveLength(1);
    });

    it('una búsqueda sin coincidencias en las bolsitas muestra un aviso propio', async () => {
      await open();
      await search('zzz');
      expect(lines('app-stock-product-row')).toHaveLength(0);
      expect(lines('app-fraction-history-line')).toHaveLength(0);
      expect(lines('.no-match').length).toBeGreaterThanOrEqual(2);
    });

    it('el historial conserva su error y «Reintentar» vuelve a pedirlo', async () => {
      await open(OVERVIEW, '/admin/stock?vista=fraccionados', false);
      httpMock.expectOne(FRACTIONS_URL).flush({}, { status: 500, statusText: 'Server Error' });
      await settle();
      expect(text()).toContain('No pudimos cargar los fraccionados');
      expect(lines('app-stock-product-row')).toHaveLength(2);
      const retry = Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Reintentar')!;
      retry.click();
      await settle();
      httpMock.expectOne(FRACTIONS_URL).flush({ fractions: FRACTIONS });
    });
  });

  describe('con un vendedor en «Viendo»', () => {
    beforeEach(() => selected.set(LUIS));

    it('muestra solo «Bolsitas en stock» con las bolsitas del vendedor y sus piezas, sin pedir el historial', async () => {
      await open(OVERVIEW, '/admin/stock?vista=fraccionados', false);
      httpMock.expectNone(FRACTIONS_URL);
      expect(text()).toContain('Bolsitas en stock');
      expect(text()).not.toContain('Últimos fraccionados');
      expect(lines('app-fraction-history-line')).toHaveLength(0);
      const rows = bagRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toContain('Creatina 300 g · bolsita 30 g');
      expect(rows[0]).toContain('3');
    });

    it('sin bolsitas dice «Luis no tiene bolsitas»', async () => {
      await open(NO_BAGS, '/admin/stock?vista=fraccionados', false);
      expect(text()).toContain('Luis no tiene bolsitas');
      expect(lines('app-stock-product-row')).toHaveLength(0);
    });

    it('el buscador filtra sus bolsitas', async () => {
      await open(OVERVIEW, '/admin/stock?vista=fraccionados', false);
      await search('zzz');
      expect(lines('app-stock-product-row')).toHaveLength(0);
    });
  });
});
