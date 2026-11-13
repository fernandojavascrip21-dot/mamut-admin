import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type {
  ConfirmReceiptPayload, CreateProductFromLinePayload, PendingReceiptLines, Receipt, ReceiptCatalogItem,
  ReceiptCategory, ReceiptLine, ReceiptPreview,
} from '../interfaces/receipt.models';
import { ReceiptsService } from './receipts.service';

const BASE = `${API_BASE_URL}/api/receipts`;
const LINE: ReceiptLine = {
  id: 5, position: 1, readName: 'Creatina', qty: 2, unitCost: '10.0000', status: 'pending', costStatus: null, product: null,
};
const RECEIPT: Receipt = {
  requestId: 'r-1', source: 'excel', fileName: 'remision.xlsx', createdAt: '2026-11-10T18:00:00Z', lines: [LINE], units: [],
};
const PREVIEW: ReceiptPreview = { source: 'excel', lines: [], skipped: [], stock: [] };
const PAYLOAD: ConfirmReceiptPayload = {
  requestId: 'r-1', source: 'excel', fileName: 'remision.xlsx',
  lines: [{ readName: 'Creatina', qty: 2, unitCost: '10.0000', productId: 1 }],
};
const CATALOG: ReceiptCatalogItem[] = [{ id: 1, name: 'Creatina', image: null, unitCost: '10.0000', units: 3 }];

describe('ReceiptsService', () => {
  let service: ReceiptsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ReceiptsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('preview manda POST /preview con un FormData que lleva el archivo en el campo «file»', () => {
    const file = new File(['x'], 'remision.xlsx');
    let result: ReceiptPreview | undefined;
    service.preview(file).subscribe((value) => (result = value));
    const request = httpMock.expectOne(`${BASE}/preview`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect((request.request.body as FormData).get('file')).toBe(file);
    request.flush(PREVIEW);
    expect(result).toEqual(PREVIEW);
  });

  it('getProducts pide GET /products y devuelve la lista de «products»', () => {
    let result: ReceiptCatalogItem[] | undefined;
    service.getProducts().subscribe((value) => (result = value));
    const request = httpMock.expectOne(`${BASE}/products`);
    expect(request.request.method).toBe('GET');
    request.flush({ products: CATALOG });
    expect(result).toEqual(CATALOG);
  });

  it('confirm manda POST a /api/receipts con el payload y devuelve receipt y replayed', () => {
    let result: { replayed: boolean } | undefined;
    service.confirm(PAYLOAD).subscribe((value) => (result = value));
    const request = httpMock.expectOne(BASE);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(PAYLOAD);
    request.flush({ receipt: RECEIPT, replayed: true });
    expect(result).toMatchObject({ receipt: RECEIPT, replayed: true });
  });

  it('get pide GET /:requestId y devuelve la remisión', () => {
    let result: Receipt | undefined;
    service.get('r-1').subscribe((value) => (result = value));
    const request = httpMock.expectOne(`${BASE}/r-1`);
    expect(request.request.method).toBe('GET');
    request.flush({ receipt: RECEIPT });
    expect(result).toEqual(RECEIPT);
  });

  it('getPending pide GET /pending', () => {
    const pending: PendingReceiptLines = { newProducts: [], costChanges: [] };
    let result: PendingReceiptLines | undefined;
    service.getPending().subscribe((value) => (result = value));
    const request = httpMock.expectOne(`${BASE}/pending`);
    expect(request.request.method).toBe('GET');
    request.flush(pending);
    expect(result).toEqual(pending);
  });

  it('createProduct manda POST /lines/:id/product con el cuerpo', () => {
    const body: CreateProductFromLinePayload = { name: 'Creatina', price: '99.00', categoryId: null };
    service.createProduct(5, body).subscribe();
    const request = httpMock.expectOne(`${BASE}/lines/5/product`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush({ product: { id: 9, name: 'Creatina' }, line: LINE, stock: { before: 0, after: 2 } });
  });

  it('discard manda POST /lines/:id/discard', () => {
    service.discard(5).subscribe();
    const request = httpMock.expectOne(`${BASE}/lines/5/discard`);
    expect(request.request.method).toBe('POST');
    request.flush({ line: LINE });
  });

  it('acceptCost manda POST /lines/:id/cost/accept', () => {
    service.acceptCost(5).subscribe();
    const request = httpMock.expectOne(`${BASE}/lines/5/cost/accept`);
    expect(request.request.method).toBe('POST');
    request.flush({ line: LINE, product: { id: 1, unitCost: '12.0000' } });
  });

  it('rejectCost manda POST /lines/:id/cost/reject', () => {
    service.rejectCost(5).subscribe();
    const request = httpMock.expectOne(`${BASE}/lines/5/cost/reject`);
    expect(request.request.method).toBe('POST');
    request.flush({ line: LINE });
  });

  it('getCategories pide GET /api/categories', () => {
    const categories: ReceiptCategory[] = [{ id: 1, name: 'Proteínas' }];
    let result: ReceiptCategory[] | undefined;
    service.getCategories().subscribe((value) => (result = value));
    const request = httpMock.expectOne(`${API_BASE_URL}/api/categories`);
    expect(request.request.method).toBe('GET');
    request.flush(categories);
    expect(result).toEqual(categories);
  });
});
