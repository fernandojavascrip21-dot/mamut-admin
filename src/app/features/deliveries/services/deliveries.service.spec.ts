import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import { DeliveriesService } from './deliveries.service';

describe('DeliveriesService', () => {
  let service: DeliveriesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DeliveriesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('create() hace POST a /api/sellers/:id/deliveries con el cuerpo', () => {
    const input = {
      requestId: 'r-1',
      productId: 10,
      qty: 6,
      unitPrice: '520.00',
      unitCostWithShipping: null,
    };
    service.create('v-1', input).subscribe();
    const req = httpMock.expectOne(`${API_BASE_URL}/api/sellers/v-1/deliveries`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush({});
  });

  it('get() pide /api/deliveries/:requestId', () => {
    service.get('r-1').subscribe();
    const req = httpMock.expectOne(`${API_BASE_URL}/api/deliveries/r-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('holding() pide /api/sellers/:id/stock/:productId', () => {
    service.holding('v-1', 10).subscribe();
    const req = httpMock.expectOne(`${API_BASE_URL}/api/sellers/v-1/stock/10`);
    expect(req.request.method).toBe('GET');
    req.flush({ units: 0, unitPrice: null, unitCostWithShipping: null });
  });
});
