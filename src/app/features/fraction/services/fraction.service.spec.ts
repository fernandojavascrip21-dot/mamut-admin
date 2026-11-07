import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type {
  CreateFractionPayload,
  Fraction,
  FractionOption,
  FractionResult,
} from '../interfaces/fraction.models';
import { FractionService } from './fraction.service';

const URL = `${API_BASE_URL}/api/fractions`;
const PAYLOAD: CreateFractionPayload = { requestId: 'r-1', productId: 10, portions: 7, price: '85.00' };
const FRACTION = { id: 1, requestId: 'r-1', portions: 7, portionUnitCost: '64.2857' } as Fraction;
const OPTION = { productId: 10, name: 'Creatina', warehouseUnits: 3 } as FractionOption;

describe('FractionService', () => {
  let service: FractionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FractionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function create(): { result: () => FractionResult | undefined } {
    let result: FractionResult | undefined;
    service.create(PAYLOAD).subscribe((r) => (result = r));
    return { result: () => result };
  }

  it('getOptions pide GET /api/fractions/options y devuelve la lista de productos', () => {
    let options: FractionOption[] | undefined;
    service.getOptions().subscribe((o) => (options = o));
    const req = httpMock.expectOne(`${URL}/options`);
    expect(req.request.method).toBe('GET');
    req.flush({ products: [OPTION] });
    expect(options).toEqual([OPTION]);
  });

  it('create manda el cuerpo tal cual a POST /api/fractions', () => {
    create();
    const req = httpMock.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(PAYLOAD);
    req.flush({ fraction: FRACTION, replayed: false }, { status: 201, statusText: 'Created' });
  });

  it('201 es un fraccionado nuevo y 200 es una repetición (replayed)', () => {
    const first = create();
    httpMock.expectOne(URL).flush({ fraction: FRACTION, replayed: false }, { status: 201, statusText: 'Created' });
    expect(first.result()).toEqual({ ok: true, fraction: FRACTION, replayed: false });

    const second = create();
    httpMock.expectOne(URL).flush({ fraction: FRACTION, replayed: true }, { status: 200, statusText: 'OK' });
    expect(second.result()).toEqual({ ok: true, fraction: FRACTION, replayed: true });
  });

  it('traduce cada error del backend a su motivo', () => {
    const cases: [number, string, string, FractionResult][] = [
      [409, 'CONFLICT', 'No hay piezas suficientes', { ok: false, reason: 'no-units', message: 'No hay piezas suficientes' }],
      [422, 'PRICE_BELOW_COST', 'Precio bajo el costo', { ok: false, reason: 'price-below-cost', message: 'Precio bajo el costo' }],
      [422, 'PORTION_COST_ZERO', 'Costo en cero', { ok: false, reason: 'portions-invalid', message: 'Costo en cero' }],
      [422, 'PORTIONS_OUT_OF_RANGE', 'Fuera de rango', { ok: false, reason: 'portions-invalid', message: 'Fuera de rango' }],
      [422, 'NOT_FRACTIONABLE', 'No se fracciona', { ok: false, reason: 'conflict', message: 'No se fracciona' }],
      [409, 'FRACTION_MISMATCH', 'Otra operación', { ok: false, reason: 'conflict', message: 'Otra operación' }],
      [409, 'CONFLICT', 'Nombre ocupado', { ok: false, reason: 'conflict', message: 'Nombre ocupado' }],
      [404, 'NOT_FOUND', 'No existe', { ok: false, reason: 'conflict', message: 'No existe' }],
      [500, 'INTERNAL', 'Falló', { ok: false, reason: 'offline', message: null }],
    ];
    for (const [status, code, message, expected] of cases) {
      const outcome = create();
      httpMock.expectOne(URL).flush({ error: { code, message } }, { status, statusText: 'Error' });
      expect(outcome.result(), `${status} ${code}`).toEqual(expected);
    }
  });

  it('sin conexión responde offline sin mensaje', () => {
    const outcome = create();
    httpMock.expectOne(URL).error(new ProgressEvent('error'));
    expect(outcome.result()).toEqual({ ok: false, reason: 'offline', message: null });
  });
});
