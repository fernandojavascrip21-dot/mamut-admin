import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { Delivery, DeliveryFormValue, DeliveryResult } from '../interfaces/delivery.models';
import { DeliverySaveService } from './delivery-save.service';

const URL = `${API_BASE_URL}/api/sellers/v-1/deliveries`;
const VALUE: DeliveryFormValue = {
  sellerId: 'v-1',
  productId: 10,
  qty: 6,
  unitPrice: '520',
  unitCostWithShipping: null,
};
const DELIVERY = { requestId: 'r', qty: 6 } as Delivery;

describe('DeliverySaveService', () => {
  let service: DeliverySaveService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DeliverySaveService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DeliverySaveService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function save(): { result: () => DeliveryResult | undefined } {
    let result: DeliveryResult | undefined;
    service.create(VALUE).subscribe((r) => (result = r));
    return { result: () => result };
  }

  it('manda el valor con un requestId UUID y devuelve la entrega', () => {
    const outcome = save();
    const req = httpMock.expectOne(URL);
    expect(req.request.body).toMatchObject({
      productId: 10,
      qty: 6,
      unitPrice: '520',
      unitCostWithShipping: null,
    });
    expect(req.request.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    req.flush(DELIVERY);
    expect(outcome.result()).toEqual({ ok: true, delivery: DELIVERY });
  });

  it('reintentar reenvía el mismo requestId', () => {
    save();
    const first = httpMock.expectOne(URL);
    const firstId = first.request.body.requestId;
    first.error(new ProgressEvent('error'));

    save();
    const second = httpMock.expectOne(URL);
    expect(second.request.body.requestId).toBe(firstId);
    second.flush(DELIVERY);
  });

  it('traduce los errores HTTP a un resultado tipado', () => {
    const cases: [number, object, DeliveryResult][] = [
      [
        409,
        { error: { message: 'No hay piezas suficientes' } },
        { ok: false, reason: 'not-enough-units', message: 'No hay piezas suficientes' },
      ],
      [
        409,
        { error: { message: 'Esta entrega ya se registró con otros datos.' } },
        { ok: false, reason: 'mismatch', message: 'Esta entrega ya se registró con otros datos.' },
      ],
      [404, { error: { message: 'No encontrado' } }, { ok: false, reason: 'not-found' }],
      [
        422,
        { error: { message: 'El precio admite hasta 2 decimales' } },
        { ok: false, reason: 'invalid', message: 'El precio admite hasta 2 decimales' },
      ],
      [500, {}, { ok: false, reason: 'offline' }],
    ];
    for (const [status, body, expected] of cases) {
      const outcome = save();
      httpMock.expectOne(URL).flush(body, { status, statusText: 'x' });
      expect(outcome.result(), String(status)).toEqual(expected);
    }
  });

  it('sin respuesta del servidor es «offline»', () => {
    const outcome = save();
    httpMock.expectOne(URL).error(new ProgressEvent('error'));
    expect(outcome.result()).toEqual({ ok: false, reason: 'offline' });
  });
});
