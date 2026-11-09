import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { FractionHistoryItem, ShrinkageHistoryItem } from '../interfaces/stock-history.models';
import { StockHistoryService } from './stock-history.service';

const SHRINKAGES_URL = `${API_BASE_URL}/api/shrinkages`;
const FRACTIONS_URL = `${API_BASE_URL}/api/fractions`;
const SHRINKAGE: ShrinkageHistoryItem = {
  requestId: 'r-1',
  createdAt: '2026-11-08T10:00:00Z',
  qty: 2,
  reason: 'damaged',
  reasonLabel: 'Dañado',
  holder: null,
  product: { id: 10, name: 'Creatina 300 g', image: null },
};
const FRACTION: FractionHistoryItem = {
  id: 1,
  requestId: 'r-1',
  createdAt: '2026-11-07T16:00:00Z',
  portions: 7,
  wholeUnitCost: '450.0000',
  portionUnitCost: '64.2857',
  portionPrice: '85.00',
  product: { id: 10, name: 'Creatina 300 g' },
  portionProduct: { id: 11, name: 'Creatina 300 g · bolsita 30 g' },
  createdBy: { id: 'a-1', name: 'Ana Admin' },
};

describe('StockHistoryService', () => {
  let service: StockHistoryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(StockHistoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('shrinkages() sin vendedor pide GET /api/shrinkages sin parámetros y devuelve la lista', () => {
    let result: ShrinkageHistoryItem[] | undefined;
    service.shrinkages().subscribe((items) => (result = items));
    const req = httpMock.expectOne(SHRINKAGES_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([SHRINKAGE]);
    expect(result).toEqual([SHRINKAGE]);
  });

  it('shrinkages(sellerId) pide GET /api/shrinkages?sellerId=…', () => {
    service.shrinkages('v-1').subscribe();
    const req = httpMock.expectOne((r) => r.url === SHRINKAGES_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('sellerId')).toBe('v-1');
    req.flush([]);
  });

  it('shrinkages() propaga el error HTTP', () => {
    let failed = false;
    service.shrinkages().subscribe({ error: () => (failed = true) });
    httpMock.expectOne(SHRINKAGES_URL).flush({}, { status: 500, statusText: 'Server Error' });
    expect(failed).toBe(true);
  });

  it('fractions() pide GET /api/fractions sin parámetros y devuelve la lista de { fractions }', () => {
    let result: FractionHistoryItem[] | undefined;
    service.fractions().subscribe((items) => (result = items));
    const req = httpMock.expectOne(FRACTIONS_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ fractions: [FRACTION] });
    expect(result).toEqual([FRACTION]);
  });

  it('fractions() propaga el error HTTP', () => {
    let failed = false;
    service.fractions().subscribe({ error: () => (failed = true) });
    httpMock.expectOne(FRACTIONS_URL).flush({}, { status: 500, statusText: 'Server Error' });
    expect(failed).toBe(true);
  });
});
