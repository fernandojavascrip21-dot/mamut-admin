import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import { ViewingService } from '@core/viewing/viewing.service';
import { SellerChangesService } from './seller-changes.service';
import { SellerUpdateService } from './seller-update.service';
import type { Seller, UpdateSellerInput, UpdateSellerResult } from '../interfaces/seller.models';

const ID = 'v-1';
const URL = `${API_BASE_URL}/api/sellers/${ID}`;
const INPUT: UpdateSellerInput = {
  fullName: 'Víctor Vendedor',
  businessName: 'Gimnasio Fuerza Norte',
  phone: '5512345678',
  email: 'victor@mammut.local',
};
const SELLER: Seller = { id: ID, ...INPUT, active: true, createdAt: '2026-11-12T18:00:00.000Z' };

describe('SellerUpdateService', () => {
  let service: SellerUpdateService;
  let httpMock: HttpTestingController;
  let results: UpdateSellerResult[];
  let viewing: { reload: ReturnType<typeof vi.fn> };
  let changes: { notify: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    viewing = { reload: vi.fn() };
    changes = { notify: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SellerUpdateService,
        { provide: ViewingService, useValue: viewing },
        { provide: SellerChangesService, useValue: changes },
      ],
    });
    service = TestBed.inject(SellerUpdateService);
    httpMock = TestBed.inject(HttpTestingController);
    results = [];
    service.update(ID, INPUT).subscribe((result) => results.push(result));
  });

  afterEach(() => httpMock.verify());

  const fail = (status: number, message = 'Mensaje') =>
    httpMock.expectOne(URL).flush({ error: { code: 'x', message } }, { status, statusText: 'Error' });

  it('manda los cuatro datos con PUT /api/sellers/:id y devuelve el vendedor', () => {
    const req = httpMock.expectOne(URL);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(INPUT);
    req.flush(SELLER);
    expect(results).toEqual([{ ok: true, seller: SELLER }]);
  });

  it('un guardado exitoso recarga «Viendo» y avisa el cambio', () => {
    httpMock.expectOne(URL).flush(SELLER);
    expect(viewing.reload).toHaveBeenCalledTimes(1);
    expect(changes.notify).toHaveBeenCalledTimes(1);
  });

  it('un 409 es correo repetido', () => {
    fail(409, 'Ya existe un acceso con ese correo');
    expect(results).toEqual([{ ok: false, reason: 'duplicate-email' }]);
  });

  it('un 422 trae el mensaje del backend', () => {
    fail(422, 'El teléfono debe tener 10 dígitos');
    expect(results).toEqual([{ ok: false, reason: 'invalid', message: 'El teléfono debe tener 10 dígitos' }]);
  });

  it('un 404 es vendedor no encontrado', () => {
    fail(404);
    expect(results).toEqual([{ ok: false, reason: 'not-found' }]);
  });

  it('sin red es offline', () => {
    httpMock.expectOne(URL).error(new ProgressEvent('error'), { status: 0 });
    expect(results).toEqual([{ ok: false, reason: 'offline' }]);
  });

  it('un 5xx es offline', () => {
    fail(500);
    expect(results).toEqual([{ ok: false, reason: 'offline' }]);
  });

  it('un error no recarga «Viendo» ni avisa el cambio', () => {
    fail(409);
    expect(viewing.reload).not.toHaveBeenCalled();
    expect(changes.notify).not.toHaveBeenCalled();
  });
});
