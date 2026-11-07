import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { FractionHistoryItem } from '../interfaces/fraction.models';
import { FractionService } from './fraction.service';

const URL = `${API_BASE_URL}/api/fractions`;
const ITEM: FractionHistoryItem = {
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

describe('FractionService · historial', () => {
  let service: FractionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FractionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getHistory pide GET /api/fractions sin parámetros y devuelve la lista de { fractions }', () => {
    let result: FractionHistoryItem[] | undefined;
    service.getHistory().subscribe((items) => (result = items));
    const req = httpMock.expectOne(URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ fractions: [ITEM] });
    expect(result).toEqual([ITEM]);
  });

  it('getHistory propaga el error HTTP', () => {
    let failed = false;
    service.getHistory().subscribe({ error: () => (failed = true) });
    httpMock.expectOne(URL).flush({}, { status: 500, statusText: 'Server Error' });
    expect(failed).toBe(true);
  });
});
