import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import { SellStockService } from './sell-stock.service';

describe('SellStockService', () => {
  let service: SellStockService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SellStockService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('load() pide GET /api/me/stock con includeSoldOut=true', async () => {
    const body = {
      total: 4,
      products: [
        { productId: 5, name: 'Creatina', image: null, units: 0, price: '499.00' },
        { productId: 3, name: 'Proteína', image: null, units: 4, price: '920.00' },
      ],
    };
    const promise = firstValueFrom(service.load());
    const req = httpMock.expectOne(`${API_BASE_URL}/api/me/stock?includeSoldOut=true`);
    expect(req.request.method).toBe('GET');
    req.flush(body);
    expect(await promise).toEqual(body);
  });

  it('no manda ningún parámetro que cambie de qué vendedor es el stock', () => {
    service.load().subscribe();
    const req = httpMock.expectOne((request) => request.url === `${API_BASE_URL}/api/me/stock`);
    expect(req.request.params.keys()).toEqual(['includeSoldOut']);
    req.flush({ total: 0, products: [] });
  });
});
