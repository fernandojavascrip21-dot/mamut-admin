import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { CreatePurchasePayload, Purchase, PurchaseProduct, PurchaseResult } from '../interfaces/purchase.models';
import { PurchaseService } from './purchase.service';

const URL = `${API_BASE_URL}/api/purchases`;
const PAYLOAD: CreatePurchasePayload = { requestId: 'r-1', productId: 10, qty: 5 };
const PURCHASE: Purchase = {
  requestId: 'r-1',
  createdAt: '2026-11-09T10:00:00Z',
  qty: 5,
  product: { id: 10, name: 'Creatina 300 g', image: null },
  stock: { before: 3, after: 8 },
};

describe('PurchaseService', () => {
  let service: PurchaseService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PurchaseService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function create(): { result: () => PurchaseResult | undefined } {
    let result: PurchaseResult | undefined;
    service.create(PAYLOAD).subscribe((r) => (result = r));
    return { result: () => result };
  }

  it('getProducts pide GET /api/products', () => {
    const products: PurchaseProduct[] = [{ id: 10, name: 'Creatina 300 g', image: null, stock: 3, parentProductId: null }];
    let got: PurchaseProduct[] | undefined;
    service.getProducts().subscribe((p) => (got = p));
    const req = httpMock.expectOne(`${API_BASE_URL}/api/products`);
    expect(req.request.method).toBe('GET');
    req.flush(products);
    expect(got).toEqual(products);
  });

  it('create manda POST /api/purchases con el payload y devuelve la entrada y replayed', () => {
    const call = create();
    const req = httpMock.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(PAYLOAD);
    req.flush({ purchase: PURCHASE, replayed: false }, { status: 201, statusText: 'Created' });
    expect(call.result()).toEqual({ ok: true, purchase: PURCHASE, replayed: false });
  });

  it('un 200 con replayed true se devuelve igual', () => {
    const call = create();
    httpMock.expectOne(URL).flush({ purchase: PURCHASE, replayed: true });
    expect(call.result()).toEqual({ ok: true, purchase: PURCHASE, replayed: true });
  });

  it('409 y 422 → conflict con el mensaje del backend', () => {
    for (const status of [409, 422]) {
      const call = create();
      httpMock.expectOne(URL).flush(
        { error: { code: 'x', message: 'Esta entrada ya se registró con otros datos.' } },
        { status, statusText: 'Error' },
      );
      expect(call.result()).toEqual({
        ok: false,
        reason: 'conflict',
        message: 'Esta entrada ya se registró con otros datos.',
      });
    }
  });

  it('404 → not-found', () => {
    const call = create();
    httpMock.expectOne(URL).flush({ error: { code: 'not_found', message: 'No encontrado' } }, { status: 404, statusText: 'Not Found' });
    expect(call.result()).toMatchObject({ ok: false, reason: 'not-found' });
  });

  it('sin red (status 0) o 5xx → offline sin mensaje', () => {
    const offline = create();
    httpMock.expectOne(URL).error(new ProgressEvent('error'), { status: 0 });
    expect(offline.result()).toEqual({ ok: false, reason: 'offline', message: null });

    const server = create();
    httpMock.expectOne(URL).flush({}, { status: 500, statusText: 'Server Error' });
    expect(server.result()).toEqual({ ok: false, reason: 'offline', message: null });
    expect(HttpErrorResponse).toBeDefined();
  });
});
