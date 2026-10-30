import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { SellersService } from './sellers.service';
import { API_BASE_URL } from '@core/api-base-url';

const SELLERS_URL = `${API_BASE_URL}/api/sellers`;

describe('SellersService', () => {
  let service: SellersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SellersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() pide GET /api/sellers', async () => {
    const promise = firstValueFrom(service.list());
    const req = httpMock.expectOne(SELLERS_URL);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'a', fullName: 'Luis', units: 6 }]);
    expect(await promise).toEqual([{ id: 'a', fullName: 'Luis', units: 6 }]);
  });

  it('get(id) pide GET /api/sellers/:id', async () => {
    const promise = firstValueFrom(service.get('abc'));
    const req = httpMock.expectOne(`${SELLERS_URL}/abc`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'abc', fullName: 'Luis', email: 'l@x.mx', phone: '5524681357', active: true, units: 0, stock: [] });
    expect((await promise).id).toBe('abc');
  });
});
