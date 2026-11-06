import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { HoldingFormValue, HoldingResult } from '../interfaces/delivery.models';
import { HoldingSaveService } from './holding-save.service';

const URL = `${API_BASE_URL}/api/sellers/v-1/stock/10`;
const VALUE: HoldingFormValue = { qty: 5, unitPrice: '520', unitCostWithShipping: null };
const HOLDING = { units: 5, unitPrice: '520.00', unitCostWithShipping: null };

describe('HoldingSaveService', () => {
  let service: HoldingSaveService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(HoldingSaveService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function save(): () => HoldingResult | undefined {
    let result: HoldingResult | undefined;
    service.save('v-1', 10, VALUE).subscribe((r) => (result = r));
    return () => result;
  }

  it('hace PATCH con el valor y devuelve lo que quedó', () => {
    const result = save();
    const req = httpMock.expectOne(URL);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(VALUE);
    req.flush(HOLDING);
    expect(result()).toEqual({ ok: true, holding: HOLDING });
  });

  it('409 «No hay piezas suficientes» es not-enough-units', () => {
    const result = save();
    httpMock
      .expectOne(URL)
      .flush({ error: { code: 'conflict', message: 'No hay piezas suficientes' } }, { status: 409, statusText: 'Conflict' });
    expect(result()).toMatchObject({ ok: false, reason: 'not-enough-units' });
  });

  it('404 es not-found y 422 es invalid con el mensaje del backend', () => {
    let result = save();
    httpMock.expectOne(URL).flush({ error: { code: 'not_found', message: 'No existe' } }, { status: 404, statusText: 'Not Found' });
    expect(result()).toEqual({ ok: false, reason: 'not-found' });

    result = save();
    httpMock
      .expectOne(URL)
      .flush({ error: { code: 'validation', message: 'El precio admite hasta 2 decimales' } }, { status: 422, statusText: 'Unprocessable' });
    expect(result()).toEqual({ ok: false, reason: 'invalid', message: 'El precio admite hasta 2 decimales' });
  });

  it('un error de red es offline', () => {
    const result = save();
    httpMock.expectOne(URL).error(new ProgressEvent('error'));
    expect(result()).toEqual({ ok: false, reason: 'offline' });
  });
});
