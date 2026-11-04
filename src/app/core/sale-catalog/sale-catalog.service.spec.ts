import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import { SaleCatalogService } from './sale-catalog.service';
import type { SaleCatalog } from './sale-catalog.models';

const CATALOG: SaleCatalog = {
  holder: null,
  products: [{ productId: 3, name: 'Proteína', image: null, units: 4, price: '920.00', unitCost: '610.5000' }],
};

describe('SaleCatalogService', () => {
  let service: SaleCatalogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SaleCatalogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('load(null) pide el catálogo de la bodega, sin parámetros', async () => {
    const result = firstValueFrom(service.load(null));
    const req = httpMock.expectOne(`${API_BASE_URL}/api/sales/catalog`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(CATALOG);
    expect(await result).toEqual(CATALOG);
  });

  it('load(id) agrega ?holderId=', async () => {
    const holderId = '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b';
    const result = firstValueFrom(service.load(holderId));
    const req = httpMock.expectOne((r) => r.url === `${API_BASE_URL}/api/sales/catalog`);
    expect(req.request.params.get('holderId')).toBe(holderId);
    req.flush({ ...CATALOG, holder: { id: holderId, fullName: 'Luis' } });
    expect((await result).holder?.id).toBe(holderId);
  });
});
