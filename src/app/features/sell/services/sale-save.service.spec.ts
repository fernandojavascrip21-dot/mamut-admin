import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { CreateSaleRequest, Sale, SaleResult } from '../interfaces/sale.models';
import { SaleSaveService } from './sale-save.service';

const URL = `${API_BASE_URL}/api/sales`;
const BODY: CreateSaleRequest = { requestId: 'r-1', lines: [{ productId: 3, qty: 2 }] };
const SALE = { id: 31, requestId: 'r-1' } as Sale;
const failure = (message: string) => ({ error: { code: 'x', message } });

// Los textos se repiten a propósito (no se importan de sales.constants): si el backend cambia sus
// mensajes, este spec avisa antes de que el frontend deje de distinguir los dos 409.
describe('SaleSaveService', () => {
  let service: SaleSaveService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SaleSaveService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SaleSaveService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function confirm(): { result: () => SaleResult | undefined } {
    let result: SaleResult | undefined;
    service.confirm(BODY).subscribe((r) => (result = r));
    return { result: () => result };
  }

  it('manda el cuerpo tal cual y devuelve la venta nueva (201)', () => {
    const outcome = confirm();
    const req = httpMock.expectOne(URL);
    expect(req.request.body).toEqual(BODY);
    req.flush({ sale: SALE, replayed: false }, { status: 201, statusText: 'Created' });
    expect(outcome.result()).toEqual({ ok: true, sale: SALE, replayed: false });
  });

  it('una venta repetida (200) llega con replayed', () => {
    const outcome = confirm();
    httpMock.expectOne(URL).flush({ sale: SALE, replayed: true });
    expect(outcome.result()).toEqual({ ok: true, sale: SALE, replayed: true });
  });

  it('409 «No hay piezas suficientes» → not-enough-units', () => {
    const outcome = confirm();
    httpMock.expectOne(URL).flush(failure('No hay piezas suficientes'), { status: 409, statusText: 'Conflict' });
    expect(outcome.result()).toEqual({ ok: false, reason: 'not-enough-units' });
  });

  it('409 «Esta venta ya se registró con otros datos.» → already-registered', () => {
    const outcome = confirm();
    httpMock
      .expectOne(URL)
      .flush(failure('Esta venta ya se registró con otros datos.'), { status: 409, statusText: 'Conflict' });
    expect(outcome.result()).toEqual({ ok: false, reason: 'already-registered' });
  });

  it('un 409 con otro mensaje → invalid con ese mensaje', () => {
    const outcome = confirm();
    httpMock.expectOne(URL).flush(failure('Otro conflicto'), { status: 409, statusText: 'Conflict' });
    expect(outcome.result()).toEqual({ ok: false, reason: 'invalid', message: 'Otro conflicto' });
  });

  it.each([404, 422])('%i → invalid con el mensaje del backend', (status) => {
    const outcome = confirm();
    httpMock.expectOne(URL).flush(failure('Producto inexistente'), { status, statusText: 'Error' });
    expect(outcome.result()).toEqual({ ok: false, reason: 'invalid', message: 'Producto inexistente' });
  });

  it('un 422 sin cuerpo usa el mensaje de respaldo', () => {
    const outcome = confirm();
    httpMock.expectOne(URL).flush(null, { status: 422, statusText: 'Unprocessable' });
    expect(outcome.result()).toEqual({ ok: false, reason: 'invalid', message: 'No se pudo registrar la venta.' });
  });

  it('500 → offline', () => {
    const outcome = confirm();
    httpMock.expectOne(URL).flush(failure('boom'), { status: 500, statusText: 'Server Error' });
    expect(outcome.result()).toEqual({ ok: false, reason: 'offline' });
  });

  it('sin respuesta (error de red) → offline', () => {
    const outcome = confirm();
    httpMock.expectOne(URL).error(new ProgressEvent('error'));
    expect(outcome.result()).toEqual({ ok: false, reason: 'offline' });
  });
});
