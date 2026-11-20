import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import { SellerPasswordService } from './seller-password.service';
import type { EmailStatus, SellerPasswordResult } from '../interfaces/seller.models';

const ID = 'v-1';
const URL = `${API_BASE_URL}/api/sellers/${ID}/password`;

describe('SellerPasswordService', () => {
  let service: SellerPasswordService;
  let httpMock: HttpTestingController;
  let results: SellerPasswordResult[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), SellerPasswordService],
    });
    service = TestBed.inject(SellerPasswordService);
    httpMock = TestBed.inject(HttpTestingController);
    results = [];
  });

  afterEach(() => httpMock.verify());

  const run = () => service.change(ID, { password: 'Clave-Nueva-1' }).subscribe((result) => results.push(result));

  it.each<EmailStatus>(['sent', 'failed', 'skipped'])('un 200 con emailStatus %s da ok con ese emailStatus', (emailStatus) => {
    run();
    httpMock.expectOne(URL).flush({ emailStatus });
    expect(results).toEqual([{ ok: true, emailStatus }]);
  });

  it('un 422 da «invalid» con el mensaje del backend', () => {
    run();
    httpMock.expectOne(URL).flush(
      { error: { code: 'validation', message: 'Usa al menos 8 caracteres' } },
      { status: 422, statusText: 'Unprocessable' },
    );
    expect(results).toEqual([{ ok: false, reason: 'invalid', message: 'Usa al menos 8 caracteres' }]);
  });

  it('un 404 da «not-found»', () => {
    run();
    httpMock.expectOne(URL).flush({ error: { code: 'not_found', message: 'x' } }, { status: 404, statusText: 'Not Found' });
    expect(results).toEqual([{ ok: false, reason: 'not-found' }]);
  });

  it('sin red (status 0) da «offline»', () => {
    run();
    httpMock.expectOne(URL).error(new ProgressEvent('error'));
    expect(results).toEqual([{ ok: false, reason: 'offline' }]);
  });

  it('un 500 da «offline»', () => {
    run();
    httpMock.expectOne(URL).flush({ error: { code: 'x', message: 'x' } }, { status: 500, statusText: 'Error' });
    expect(results).toEqual([{ ok: false, reason: 'offline' }]);
  });
});
