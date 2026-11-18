import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import { SellersService } from './sellers.service';
import type { SellerPasswordResponse } from '../interfaces/seller.models';

const ID = 'v-1';

describe('SellersService: contraseña temporal (HU-45)', () => {
  let service: SellersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SellersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('setPassword pide PUT /api/sellers/:id/password con { password } y devuelve emailStatus', () => {
    let result: SellerPasswordResponse | undefined;
    service.setPassword(ID, { password: 'Clave-Nueva-1' }).subscribe((value) => (result = value));
    const req = httpMock.expectOne(`${API_BASE_URL}/api/sellers/${ID}/password`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ password: 'Clave-Nueva-1' });
    req.flush({ emailStatus: 'sent' });
    expect(result).toEqual({ emailStatus: 'sent' });
  });
});
