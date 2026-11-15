import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { ConfirmReceiptPayload, CreateProductFromLinePayload, PendingReceiptLines } from '../interfaces/receipt.models';
import { ReceiptsService } from './receipts.service';

const BASE = `${API_BASE_URL}/api/receipts`;

describe('ReceiptsService con renglones por completar', () => {
  let service: ReceiptsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ReceiptsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('confirm manda incomplete en el mismo POST /api/receipts', () => {
    const payload: ConfirmReceiptPayload = {
      requestId: 'r-1', source: 'image', fileName: null, lines: [],
      incomplete: [{ readName: 'Bloom', unitCost: '495.0000' }],
    };
    service.confirm(payload).subscribe();
    const request = httpMock.expectOne(BASE);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({ receipt: {}, replayed: false });
  });

  it('getPending sigue en GET /pending y devuelve incompleteProducts', () => {
    const body: PendingReceiptLines = {
      newProducts: [], costChanges: [],
      incompleteProducts: [{
        lineId: 1, receipt: { requestId: 'r-1', createdAt: '2026-11-10T18:00:00Z' },
        suggestedName: 'Bloom', qty: null, unitCost: '495.0000',
      }],
    };
    let result: PendingReceiptLines | undefined;
    service.getPending().subscribe((value) => (result = value));
    httpMock.expectOne(`${BASE}/pending`).flush(body);
    expect(result).toEqual(body);
  });

  it('createProduct manda qty en el cuerpo de POST /lines/:id/product', () => {
    const payload: CreateProductFromLinePayload = { name: 'Bloom', price: '600', categoryId: null, qty: 6 };
    service.createProduct(9, payload).subscribe();
    const request = httpMock.expectOne(`${BASE}/lines/9/product`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({});
  });
});
