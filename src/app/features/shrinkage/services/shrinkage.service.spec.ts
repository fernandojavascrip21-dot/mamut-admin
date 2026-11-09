import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type {
  CreateShrinkagePayload,
  Shrinkage,
  ShrinkageOptions,
  ShrinkageResult,
} from '../interfaces/shrinkage.models';
import { ShrinkageService } from './shrinkage.service';

const URL = `${API_BASE_URL}/api/shrinkages`;
const PAYLOAD: CreateShrinkagePayload = {
  requestId: 'r-1',
  holderProfileId: 'v-1',
  productId: 10,
  qty: 2,
  reason: 'damaged',
};
const SHRINKAGE: Shrinkage = {
  requestId: 'r-1',
  createdAt: '2026-11-08T10:00:00Z',
  qty: 2,
  reason: 'damaged',
  reasonLabel: 'Dañado',
  holder: { id: 'v-1', fullName: 'Luis Prueba' },
  product: { id: 10, name: 'Creatina 300 g', image: null },
  stock: { before: 6, after: 4 },
};
const OPTIONS: ShrinkageOptions = {
  holder: { id: 'v-1', fullName: 'Luis Prueba' },
  products: [{ productId: 10, name: 'Creatina 300 g', image: null, units: 6 }],
  reasons: [{ code: 'lost', label: 'Se perdió' }],
};

describe('ShrinkageService', () => {
  let service: ShrinkageService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ShrinkageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function create(): { result: () => ShrinkageResult | undefined } {
    let result: ShrinkageResult | undefined;
    service.create(PAYLOAD).subscribe((r) => (result = r));
    return { result: () => result };
  }

  it('getOptions sin vendedor pide GET /api/shrinkages/options sin parámetros (bodega)', () => {
    let options: ShrinkageOptions | undefined;
    service.getOptions().subscribe((o) => (options = o));
    const req = httpMock.expectOne(`${URL}/options`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(OPTIONS);
    expect(options).toEqual(OPTIONS);
  });

  it('getOptions con vendedor manda ?sellerId=', () => {
    service.getOptions('v-1').subscribe();
    const req = httpMock.expectOne((r) => r.url === `${URL}/options`);
    expect(req.request.params.get('sellerId')).toBe('v-1');
    req.flush(OPTIONS);
  });

  it('create manda el cuerpo tal cual a POST /api/shrinkages', () => {
    create();
    const req = httpMock.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(PAYLOAD);
    req.flush({ shrinkage: SHRINKAGE, replayed: false }, { status: 201, statusText: 'Created' });
  });

  it('201 es una merma nueva y 200 es una repetición (replayed)', () => {
    const first = create();
    httpMock.expectOne(URL).flush({ shrinkage: SHRINKAGE, replayed: false }, { status: 201, statusText: 'Created' });
    expect(first.result()).toEqual({ ok: true, shrinkage: SHRINKAGE, replayed: false });

    const second = create();
    httpMock.expectOne(URL).flush({ shrinkage: SHRINKAGE, replayed: true }, { status: 200, statusText: 'OK' });
    expect(second.result()).toEqual({ ok: true, shrinkage: SHRINKAGE, replayed: true });
  });

  it('traduce cada error del backend a su motivo', () => {
    const cases: [number, string, string, ShrinkageResult][] = [
      [409, 'CONFLICT', 'No hay piezas suficientes', { ok: false, reason: 'no-units', message: 'No hay piezas suficientes' }],
      [409, 'SHRINKAGE_MISMATCH', 'Esta merma ya se registró con otros datos.', { ok: false, reason: 'conflict', message: 'Esta merma ya se registró con otros datos.' }],
      [404, 'NOT_FOUND', 'No encontramos a este vendedor', { ok: false, reason: 'not-found', message: 'No encontramos a este vendedor' }],
      [422, 'validation', 'El motivo debe ser lost, damaged, expired u other', { ok: false, reason: 'conflict', message: 'El motivo debe ser lost, damaged, expired u other' }],
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
