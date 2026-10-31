import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import { DeliveryProductsService } from './delivery-products.service';

describe('DeliveryProductsService', () => {
  let service: DeliveryProductsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DeliveryProductsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() pide /api/products', () => {
    service.list().subscribe();
    httpMock.expectOne(`${API_BASE_URL}/api/products`).flush([]);
  });

  it('get() pide /api/products/:id', () => {
    service.get(10).subscribe();
    httpMock.expectOne(`${API_BASE_URL}/api/products/10`).flush({});
  });
});
