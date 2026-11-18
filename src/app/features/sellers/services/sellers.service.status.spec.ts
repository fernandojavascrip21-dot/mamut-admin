import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import { SellersService } from './sellers.service';
import type { Seller, SellerDetail, SellerSummary } from '../interfaces/seller.models';

const ID = 'v-1';
const LIST_URL = `${API_BASE_URL}/api/sellers`;
const SELLER_URL = `${LIST_URL}/${ID}`;
const SELLER: Seller = {
  id: ID,
  fullName: 'Víctor Vendedor',
  businessName: 'Gimnasio Fuerza Norte',
  email: 'victor@mammut.local',
  phone: '5512345678',
  active: false,
  createdAt: '2026-11-12T18:00:00.000Z',
};

describe('SellersService: estado del vendedor (HU-44)', () => {
  let service: SellersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SellersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getAny pide GET /api/sellers/:id?status=any', () => {
    const detail: SellerDetail = { ...SELLER, units: 0, stock: [] };
    let result: SellerDetail | undefined;
    service.getAny(ID).subscribe((value) => (result = value));
    const req = httpMock.expectOne(`${SELLER_URL}?status=any`);
    expect(req.request.method).toBe('GET');
    req.flush(detail);
    expect(result).toEqual(detail);
  });

  it('get no cambia: sigue pidiendo /api/sellers/:id sin parámetro', () => {
    service.get(ID).subscribe();
    httpMock.expectOne(SELLER_URL).flush({});
  });

  it('list() y list(\'active\') piden /api/sellers sin parámetro', () => {
    service.list().subscribe();
    httpMock.expectOne(LIST_URL).flush([]);
    service.list('active').subscribe();
    httpMock.expectOne(LIST_URL).flush([]);
  });

  it('list(\'inactive\') pide /api/sellers?status=inactive', () => {
    const rows: SellerSummary[] = [{ id: ID, fullName: 'Víctor Vendedor', businessName: null, units: 0 }];
    let result: SellerSummary[] | undefined;
    service.list('inactive').subscribe((value) => (result = value));
    const requests = httpMock.match(() => true);
    expect(requests.map((req) => req.request.urlWithParams)).toEqual([`${LIST_URL}?status=inactive`]);
    expect(requests[0]!.request.method).toBe('GET');
    requests[0]!.flush(rows);
    expect(result).toEqual(rows);
  });

  it('deactivate manda POST /api/sellers/:id/deactivate y devuelve el vendedor con emailStatus', () => {
    let result: unknown;
    service.deactivate(ID).subscribe((value) => (result = value));
    const req = httpMock.expectOne(`${SELLER_URL}/deactivate`);
    expect(req.request.method).toBe('POST');
    req.flush({ ...SELLER, emailStatus: 'sent' });
    expect(result).toEqual({ ...SELLER, emailStatus: 'sent' });
  });

  it('reactivate manda POST /api/sellers/:id/reactivate y devuelve el vendedor con emailStatus', () => {
    let result: unknown;
    service.reactivate(ID).subscribe((value) => (result = value));
    const req = httpMock.expectOne(`${SELLER_URL}/reactivate`);
    expect(req.request.method).toBe('POST');
    req.flush({ ...SELLER, active: true, emailStatus: null });
    expect(result).toEqual({ ...SELLER, active: true, emailStatus: null });
  });

  it('remove manda DELETE /api/sellers/:id y completa con el 204', () => {
    let done = false;
    service.remove(ID).subscribe({ complete: () => (done = true) });
    const req = httpMock.expectOne(SELLER_URL);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(done).toBe(true);
  });

  it('codifica el id en las rutas de estado', () => {
    service.deactivate('a/b').subscribe();
    httpMock.expectOne(`${LIST_URL}/a%2Fb/deactivate`).flush({});
  });
});
