import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { CreateSaleRequest, Sale } from '../interfaces/sale.models';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  let service: SalesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SalesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('create() hace POST a /api/sales con el cuerpo', () => {
    const body: CreateSaleRequest = { requestId: 'r-1', lines: [{ productId: 3, qty: 2 }] };
    const response = { sale: { id: 1 } as Sale, replayed: false };
    let received: unknown;
    service.create(body).subscribe((r) => (received = r));
    const req = httpMock.expectOne(`${API_BASE_URL}/api/sales`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush(response);
    expect(received).toEqual(response);
  });

  it('get() hace GET a /api/sales/<requestId>', () => {
    service.get('6f1c-uuid').subscribe();
    const req = httpMock.expectOne(`${API_BASE_URL}/api/sales/6f1c-uuid`);
    expect(req.request.method).toBe('GET');
    req.flush({ sale: { id: 1 }, replayed: false });
  });
});
