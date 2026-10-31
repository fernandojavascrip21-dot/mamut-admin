import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { ReturnFormValue, ReturnResult, SellerReturn } from '../interfaces/seller.models';
import { ReturnSaveService } from './return-save.service';

const URL = `${API_BASE_URL}/api/sellers/v-1/returns`;
const VALUE: ReturnFormValue = { productId: 10, qty: 2 };
const SELLER_RETURN = { requestId: 'r', qty: 2 } as SellerReturn;

describe('ReturnSaveService', () => {
  let service: ReturnSaveService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ReturnSaveService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReturnSaveService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function save(): { result: () => ReturnResult | undefined } {
    let result: ReturnResult | undefined;
    service.create('v-1', VALUE).subscribe((r) => (result = r));
    return { result: () => result };
  }

  it('manda el valor con un requestId UUID y devuelve el retiro', () => {
    const outcome = save();
    const req = httpMock.expectOne(URL);
    expect(req.request.body).toMatchObject({ productId: 10, qty: 2 });
    expect(req.request.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    req.flush(SELLER_RETURN);
    expect(outcome.result()).toEqual({ ok: true, sellerReturn: SELLER_RETURN });
  });

  it('reintentar reenvía el mismo requestId', () => {
    save();
    const first = httpMock.expectOne(URL);
    const firstId = first.request.body.requestId;
    first.error(new ProgressEvent('error'));

    save();
    const second = httpMock.expectOne(URL);
    expect(second.request.body.requestId).toBe(firstId);
    second.flush(SELLER_RETURN);
  });

  it('traduce los errores HTTP a un resultado tipado', () => {
    const cases: [number, object, ReturnResult][] = [
      [
        409,
        { error: { message: 'No hay piezas suficientes' } },
        { ok: false, reason: 'not-enough-units', message: 'No hay piezas suficientes' },
      ],
      [
        409,
        { error: { message: 'Este retiro ya se registró con otros datos.' } },
        { ok: false, reason: 'mismatch', message: 'Este retiro ya se registró con otros datos.' },
      ],
      [404, { error: { message: 'No encontrado' } }, { ok: false, reason: 'not-found' }],
      [
        422,
        { error: { message: 'El campo qty debe ser un entero mayor a 0' } },
        { ok: false, reason: 'invalid', message: 'El campo qty debe ser un entero mayor a 0' },
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
