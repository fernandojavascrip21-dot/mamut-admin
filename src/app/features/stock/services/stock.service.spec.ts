import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import { StockService } from './stock.service';

describe('StockService', () => {
  let service: StockService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(StockService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('overview() pide GET /api/stock', async () => {
    const body = { warehouse: 4, sellers: [], inactiveSellers: 0, total: 4, products: [], lowStock: [] };
    const promise = firstValueFrom(service.overview());
    const req = httpMock.expectOne(`${API_BASE_URL}/api/stock`);
    expect(req.request.method).toBe('GET');
    req.flush(body);
    expect(await promise).toEqual(body);
  });
});
