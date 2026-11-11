import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { RestockOrder, RestockOrderLookup, RestockOrderSummary } from '../interfaces/restock.models';
import { RestockService } from './restock.service';

const ORDERS = `${API_BASE_URL}/api/restock/orders`;

const ORDER: RestockOrder = {
  id: 12, status: 'closed', note: null, createdAt: '2026-11-09T18:00:00Z', updatedAt: '2026-11-10T01:00:00Z',
  closedAt: '2026-11-10T01:00:00Z', lineCount: 1, totalUnits: 2, estimatedTotal: '240.00', requestId: 'r-12',
  lines: [{ product: { id: 1, name: 'Creatina', image: null }, qty: 2, unitCost: '120.0000' }], customLines: [],
};
const SUMMARY: RestockOrderSummary = {
  id: 12, status: 'closed', note: null, createdAt: ORDER.createdAt, updatedAt: ORDER.updatedAt,
  closedAt: ORDER.closedAt, lineCount: 1, totalUnits: 2, estimatedTotal: '240.00',
};
const failure = (status: number) =>
  [{ error: { code: 'x', message: 'Mensaje' } }, { status, statusText: 'Error' }] as const;

describe('RestockService · pedidos anteriores (HU-32)', () => {
  let service: RestockService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RestockService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('listClosed', () => {
    it('pide GET ?status=closed y entrega la lista de pedidos', () => {
      let result: RestockOrderSummary[] | undefined;
      service.listClosed().subscribe((orders) => (result = orders));
      const req = httpMock.expectOne(`${ORDERS}?status=closed`);
      expect(req.request.method).toBe('GET');
      req.flush({ orders: [SUMMARY] });
      expect(result).toEqual([SUMMARY]);
    });

    it('deja pasar el error para que lo atrape el rxResource', () => {
      let failed: unknown;
      service.listClosed().subscribe({ error: (error: unknown) => (failed = error) });
      httpMock.expectOne(`${ORDERS}?status=closed`).flush(...failure(500));
      expect(failed).toBeDefined();
    });
  });

  describe('getOrder', () => {
    it('pide GET /orders/:id y devuelve { found: true, order }', () => {
      let result: RestockOrderLookup | undefined;
      service.getOrder(12).subscribe((lookup) => (result = lookup));
      const req = httpMock.expectOne(`${ORDERS}/12`);
      expect(req.request.method).toBe('GET');
      req.flush({ order: ORDER });
      expect(result).toEqual({ found: true, order: ORDER });
    });

    it('con 404 devuelve { found: false } sin lanzar', () => {
      let result: RestockOrderLookup | undefined;
      service.getOrder(99).subscribe((lookup) => (result = lookup));
      httpMock.expectOne(`${ORDERS}/99`).flush(...failure(404));
      expect(result).toEqual({ found: false });
    });

    it.each([403, 500])('con %s deja pasar el error', (status) => {
      let failed: unknown;
      let result: RestockOrderLookup | undefined;
      service.getOrder(12).subscribe({ next: (lookup) => (result = lookup), error: (error: unknown) => (failed = error) });
      httpMock.expectOne(`${ORDERS}/12`).flush(...failure(status));
      expect(result).toBeUndefined();
      expect(failed).toBeDefined();
    });
  });
});
