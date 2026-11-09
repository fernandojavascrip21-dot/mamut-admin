import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { ShrinkageHistoryItem } from '../interfaces/shrinkage.models';
import { ShrinkageService } from './shrinkage.service';

const URL = `${API_BASE_URL}/api/shrinkages`;
const ITEM: ShrinkageHistoryItem = {
  requestId: 'r-1',
  createdAt: '2026-11-08T10:00:00Z',
  qty: 2,
  reason: 'damaged',
  reasonLabel: 'Dañado',
  holder: null,
  product: { id: 10, name: 'Creatina 300 g', image: null },
};

describe('ShrinkageService · historial (HU-26)', () => {
  let service: ShrinkageService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ShrinkageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() sin vendedor pide GET /api/shrinkages sin parámetros y devuelve la lista', () => {
    let result: ShrinkageHistoryItem[] | undefined;
    service.list().subscribe((items) => (result = items));
    const req = httpMock.expectOne(URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([ITEM]);
    expect(result).toEqual([ITEM]);
  });

  it('list(sellerId) pide GET /api/shrinkages?sellerId=…', () => {
    service.list('v-1').subscribe();
    const req = httpMock.expectOne((r) => r.url === URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('sellerId')).toBe('v-1');
    req.flush([]);
  });

  it('list() propaga el error HTTP', () => {
    let failed = false;
    service.list().subscribe({ error: () => (failed = true) });
    httpMock.expectOne(URL).flush({}, { status: 500, statusText: 'Server Error' });
    expect(failed).toBe(true);
  });
});
