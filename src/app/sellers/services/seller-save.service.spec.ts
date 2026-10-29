import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SellerSaveService } from './seller-save.service';
import { API_BASE_URL } from '@shared/api-base-url';
import type { CreateSellerInput, CreateSellerResult, Seller } from '../interfaces/seller.models';

const SELLERS_URL = `${API_BASE_URL}/api/sellers`;
const INPUT: CreateSellerInput = { fullName: 'Luis', phone: '55 2468 1357', email: 'luis@mammut.mx', password: 'temporal123' };
const SELLER: Seller = { id: 'u1', fullName: 'Luis', email: 'luis@mammut.mx', phone: '5524681357', active: true };

describe('SellerSaveService', () => {
  let service: SellerSaveService;
  let httpMock: HttpTestingController;
  let results: CreateSellerResult[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), SellerSaveService],
    });
    service = TestBed.inject(SellerSaveService);
    httpMock = TestBed.inject(HttpTestingController);
    results = [];
    service.create(INPUT).subscribe((result) => results.push(result));
  });

  afterEach(() => httpMock.verify());

  it('manda el cuerpo tal cual a POST /api/sellers y devuelve el vendedor', () => {
    const req = httpMock.expectOne(SELLERS_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(INPUT);
    req.flush(SELLER);
    expect(results).toEqual([{ ok: true, seller: SELLER }]);
  });

  it('un 409 es correo repetido', () => {
    httpMock.expectOne(SELLERS_URL).flush(
      { error: { code: 'conflict', message: 'Ya existe un acceso con ese correo' } },
      { status: 409, statusText: 'Conflict' },
    );
    expect(results).toEqual([{ ok: false, reason: 'duplicate-email' }]);
  });

  it('un 422 trae el mensaje del backend', () => {
    httpMock.expectOne(SELLERS_URL).flush(
      { error: { code: 'validation', message: 'El teléfono debe tener 10 dígitos' } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    expect(results).toEqual([{ ok: false, reason: 'invalid', message: 'El teléfono debe tener 10 dígitos' }]);
  });

  it('sin red o un 5xx es offline', () => {
    httpMock.expectOne(SELLERS_URL).error(new ProgressEvent('error'), { status: 0 });
    expect(results).toEqual([{ ok: false, reason: 'offline' }]);
  });
});
