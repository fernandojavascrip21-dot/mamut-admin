import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type {
  CreateRestockOrderPayload, RestockDiscardResult, RestockOrder, RestockProduct, RestockResult, RestockSuggestion,
  UpdateRestockOrderPayload,
} from '../interfaces/restock.models';
import type { RestockPageData } from '../models/restock-page.models';
import { RestockService } from './restock.service';

const ORDERS = `${API_BASE_URL}/api/restock/orders`;
const DRAFTS = `${ORDERS}?status=draft`;
const SUGGESTIONS_URL = `${API_BASE_URL}/api/restock/suggestions`;
const PRODUCTS_URL = `${API_BASE_URL}/api/restock/products`;

const SUGGESTIONS: RestockSuggestion[] = [
  { productId: 1, name: 'Creatina', image: null, units: 0, stockLevel: 'out', unitCost: '120.0000' },
];
const PRODUCTS: RestockProduct[] = [
  { productId: 1, name: 'Creatina', image: null, units: 0, stockLevel: 'out', unitCost: '120.0000' },
  { productId: 2, name: 'Barra', image: null, units: 30, stockLevel: 'ok', unitCost: '10.0000' },
];
const ORDER: RestockOrder = {
  id: 7, status: 'draft', note: null, createdAt: '2026-11-09T18:00:00Z', updatedAt: '2026-11-09T18:00:00Z',
  closedAt: null, lineCount: 1, totalUnits: 2, estimatedTotal: '240.00', requestId: 'r-1',
  lines: [{ product: { id: 1, name: 'Creatina', image: null }, qty: 2, unitCost: '120.0000' }], customLines: [],
};
const SUMMARY = { ...ORDER, lines: undefined, customLines: undefined, requestId: undefined };
const CREATE: CreateRestockOrderPayload = {
  requestId: 'r-1', note: null, lines: [{ productId: 1, qty: 2, unitCost: '120.0000' }, { name: 'Shaker', qty: 1, unitCost: null }],
};
const UPDATE: UpdateRestockOrderPayload = { note: 'x', lines: CREATE.lines };
const failure = (status: number, message = 'Mensaje del backend') =>
  [{ error: { code: 'x', message } }, { status, statusText: 'Error' }] as const;

describe('RestockService', () => {
  let service: RestockService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RestockService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getPageData', () => {
    const load = () => {
      let data: RestockPageData | undefined;
      service.getPageData().subscribe((d) => (data = d));
      return () => data;
    };

    it('con borrador pide las sugerencias, los productos y el detalle del primero', () => {
      const data = load();
      httpMock.expectOne(SUGGESTIONS_URL).flush({ suggestions: SUGGESTIONS });
      httpMock.expectOne(PRODUCTS_URL).flush({ products: PRODUCTS });
      httpMock.expectOne(DRAFTS).flush({ orders: [SUMMARY, { ...SUMMARY, id: 3 }] });
      const detail = httpMock.expectOne(`${ORDERS}/7`);
      expect(detail.request.method).toBe('GET');
      detail.flush({ order: ORDER });
      expect(data()).toEqual({ draft: ORDER, suggestions: SUGGESTIONS, products: PRODUCTS });
    });

    it('sin borrador no pide detalle y draft es null', () => {
      const data = load();
      httpMock.expectOne(SUGGESTIONS_URL).flush({ suggestions: SUGGESTIONS });
      httpMock.expectOne(PRODUCTS_URL).flush({ products: PRODUCTS });
      httpMock.expectOne(DRAFTS).flush({ orders: [] });
      expect(data()).toEqual({ draft: null, suggestions: SUGGESTIONS, products: PRODUCTS });
    });

    it('si una de las cargas falla, el observable falla', () => {
      let failed = false;
      service.getPageData().subscribe({ error: () => (failed = true) });
      httpMock.expectOne(SUGGESTIONS_URL).flush(...failure(500));
      httpMock.match(PRODUCTS_URL);
      httpMock.match(DRAFTS);
      expect(failed).toBe(true);
    });
  });

  describe('create', () => {
    const create = () => {
      let result: RestockResult | undefined;
      service.create(CREATE).subscribe((r) => (result = r));
      return () => result;
    };

    it('manda POST /api/restock/orders con el payload y devuelve el pedido con 201', () => {
      const result = create();
      const req = httpMock.expectOne(ORDERS);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(CREATE);
      req.flush({ order: ORDER, replayed: false }, { status: 201, statusText: 'Created' });
      expect(result()).toEqual({ ok: true, order: ORDER });
    });

    it('un 200 con replayed true se traduce igual', () => {
      const result = create();
      httpMock.expectOne(ORDERS).flush({ order: ORDER, replayed: true });
      expect(result()).toEqual({ ok: true, order: ORDER });
    });

    it('422 → invalid con el mensaje del backend', () => {
      const result = create();
      httpMock.expectOne(ORDERS).flush(...failure(422, 'Un producto escrito aparece dos veces en el pedido'));
      expect(result()).toEqual({ ok: false, reason: 'invalid', message: 'Un producto escrito aparece dos veces en el pedido' });
    });

    it('409 «Este pedido ya está cerrado.» → closed', () => {
      const result = create();
      httpMock.expectOne(ORDERS).flush(...failure(409, 'Este pedido ya está cerrado.'));
      expect(result()).toEqual({ ok: false, reason: 'closed', message: 'Este pedido ya está cerrado.' });
    });

    it('409 de otro motivo (requestId con otros datos) → conflict', () => {
      const result = create();
      httpMock.expectOne(ORDERS).flush(...failure(409, 'Este pedido ya se registró con otros datos.'));
      expect(result()).toEqual({ ok: false, reason: 'conflict', message: 'Este pedido ya se registró con otros datos.' });
    });

    it('404 → not-found con el mensaje', () => {
      const result = create();
      httpMock.expectOne(ORDERS).flush(...failure(404, 'Producto no encontrado'));
      expect(result()).toEqual({ ok: false, reason: 'not-found', message: 'Producto no encontrado' });
    });

    it('sin conexión o 5xx → offline sin mensaje', () => {
      const first = create();
      httpMock.expectOne(ORDERS).error(new ProgressEvent('error'));
      expect(first()).toEqual({ ok: false, reason: 'offline', message: null });
      const second = create();
      httpMock.expectOne(ORDERS).flush(...failure(503));
      expect(second()).toEqual({ ok: false, reason: 'offline', message: null });
    });
  });

  describe('update', () => {
    const update = () => {
      let result: RestockResult | undefined;
      service.update(7, UPDATE).subscribe((r) => (result = r));
      return () => result;
    };

    it('manda PUT /api/restock/orders/7 con { note, lines } y devuelve el pedido', () => {
      const result = update();
      const req = httpMock.expectOne(`${ORDERS}/7`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(UPDATE);
      req.flush({ order: ORDER });
      expect(result()).toEqual({ ok: true, order: ORDER });
    });

    it('traduce 422, 409 cerrado, 404 y sin conexión', () => {
      const cases: [number, RestockResult][] = [
        [422, { ok: false, reason: 'invalid', message: 'M' }],
        [404, { ok: false, reason: 'not-found', message: 'M' }],
        [500, { ok: false, reason: 'offline', message: null }],
      ];
      for (const [status, expected] of cases) {
        const result = update();
        httpMock.expectOne(`${ORDERS}/7`).flush(...failure(status, 'M'));
        expect(result()).toEqual(expected);
      }
      const closed = update();
      httpMock.expectOne(`${ORDERS}/7`).flush(...failure(409, 'Este pedido ya está cerrado.'));
      expect(closed()).toMatchObject({ ok: false, reason: 'closed' });
    });
  });

  describe('close', () => {
    const close = () => {
      let result: RestockResult | undefined;
      service.close(7).subscribe((r) => (result = r));
      return () => result;
    };

    it('manda POST /api/restock/orders/7/close y devuelve el pedido cerrado', () => {
      const result = close();
      const req = httpMock.expectOne(`${ORDERS}/7/close`);
      expect(req.request.method).toBe('POST');
      req.flush({ order: { ...ORDER, status: 'closed' } });
      expect(result()).toEqual({ ok: true, order: { ...ORDER, status: 'closed' } });
    });

    it('409 cerrado, 422 pedido vacío y sin conexión', () => {
      const closed = close();
      httpMock.expectOne(`${ORDERS}/7/close`).flush(...failure(409, 'Este pedido ya está cerrado.'));
      expect(closed()).toMatchObject({ ok: false, reason: 'closed' });
      const empty = close();
      httpMock.expectOne(`${ORDERS}/7/close`).flush(...failure(422, 'No se puede cerrar un pedido sin productos'));
      expect(empty()).toEqual({ ok: false, reason: 'invalid', message: 'No se puede cerrar un pedido sin productos' });
      const offline = close();
      httpMock.expectOne(`${ORDERS}/7/close`).error(new ProgressEvent('error'));
      expect(offline()).toEqual({ ok: false, reason: 'offline', message: null });
    });
  });

  describe('discard', () => {
    const discard = () => {
      let result: RestockDiscardResult | undefined;
      service.discard(7).subscribe((r) => (result = r));
      return () => result;
    };

    it('manda DELETE /api/restock/orders/7 y con 204 devuelve ok', () => {
      const result = discard();
      const req = httpMock.expectOne(`${ORDERS}/7`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
      expect(result()).toEqual({ ok: true });
    });

    it('un 404 se trata como descartado', () => {
      const result = discard();
      httpMock.expectOne(`${ORDERS}/7`).flush(...failure(404, 'No encontrado'));
      expect(result()).toEqual({ ok: true });
    });

    it('un 409 cerrado y la falta de conexión son fallos', () => {
      const closed = discard();
      httpMock.expectOne(`${ORDERS}/7`).flush(...failure(409, 'Este pedido ya está cerrado.'));
      expect(closed()).toMatchObject({ ok: false, reason: 'closed' });
      const offline = discard();
      httpMock.expectOne(`${ORDERS}/7`).error(new ProgressEvent('error'));
      expect(offline()).toEqual({ ok: false, reason: 'offline', message: null });
    });
  });
});
