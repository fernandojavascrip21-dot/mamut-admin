import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import type { ShrinkageHistoryItem } from '../interfaces/seller.models';
import { SellerShrinkagesService } from './seller-shrinkages.service';

const SHRINKAGES_URL = `${API_BASE_URL}/api/sellers/v-1/shrinkages`;
const ITEMS: ShrinkageHistoryItem[] = [
  {
    requestId: 'r-1',
    createdAt: '2026-11-08T10:00:00Z',
    qty: 2,
    reason: 'lost',
    reasonLabel: 'Se perdió',
    holder: { id: 'v-1', fullName: 'Luis Prueba' },
    product: { id: 10, name: 'Proteína', image: null },
  },
];

describe('SellerShrinkagesService', () => {
  let service: SellerShrinkagesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SellerShrinkagesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() pide GET /api/sellers/:id/shrinkages y devuelve la lista', async () => {
    const promise = firstValueFrom(service.list('v-1'));
    const req = httpMock.expectOne(SHRINKAGES_URL);
    expect(req.request.method).toBe('GET');
    req.flush(ITEMS);
    expect(await promise).toEqual(ITEMS);
  });

  it('codifica el id del vendedor en la URL', () => {
    service.list('a/b').subscribe();
    httpMock.expectOne(`${API_BASE_URL}/api/sellers/a%2Fb/shrinkages`).flush([]);
  });
});
