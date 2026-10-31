import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import type { ReturnHistoryItem, SellerReturn } from '../interfaces/seller.models';
import { SellerReturnsService } from './seller-returns.service';

const RETURNS_URL = `${API_BASE_URL}/api/sellers/v-1/returns`;

describe('SellerReturnsService', () => {
  let service: SellerReturnsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SellerReturnsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('create() manda POST con el cuerpo y devuelve el retiro', async () => {
    const input = { requestId: 'r-1', productId: 10, qty: 2 };
    const sellerReturn = { requestId: 'r-1', qty: 2 } as SellerReturn;
    const promise = firstValueFrom(service.create('v-1', input));
    const req = httpMock.expectOne(RETURNS_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush(sellerReturn);
    expect(await promise).toEqual(sellerReturn);
  });

  it('get() pide el resumen del retiro de ese vendedor', async () => {
    const sellerReturn = { requestId: 'r-1', qty: 2 } as SellerReturn;
    const promise = firstValueFrom(service.get('v-1', 'r-1'));
    const req = httpMock.expectOne(`${RETURNS_URL}/r-1`);
    expect(req.request.method).toBe('GET');
    req.flush(sellerReturn);
    expect(await promise).toEqual(sellerReturn);
  });

  it('list() pide los últimos retiros', async () => {
    const items: ReturnHistoryItem[] = [
      { requestId: 'r-1', createdAt: '2026-10-31T10:00:00Z', productId: 10, name: 'Proteína', image: null, qty: 2 },
    ];
    const promise = firstValueFrom(service.list('v-1'));
    const req = httpMock.expectOne(RETURNS_URL);
    expect(req.request.method).toBe('GET');
    req.flush(items);
    expect(await promise).toEqual(items);
  });

  it('codifica el id del vendedor en la URL', () => {
    service.list('a/b').subscribe();
    httpMock.expectOne(`${API_BASE_URL}/api/sellers/a%2Fb/returns`).flush([]);
  });
});
