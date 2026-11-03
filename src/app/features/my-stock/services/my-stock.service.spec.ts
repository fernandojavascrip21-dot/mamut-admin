import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import { MyStockService } from './my-stock.service';

describe('MyStockService', () => {
  let service: MyStockService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MyStockService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('load() pide GET /api/me/stock', async () => {
    const body = {
      total: 6,
      products: [{ productId: 10, name: 'Proteína', image: null, units: 6, price: '480.00' }],
    };
    const promise = firstValueFrom(service.load());
    const req = httpMock.expectOne(`${API_BASE_URL}/api/me/stock`);
    expect(req.request.method).toBe('GET');
    req.flush(body);
    expect(await promise).toEqual(body);
  });
});
