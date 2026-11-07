import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { CreateFractionPayload, Fraction } from '../interfaces/fraction.models';
import { FractionService } from './fraction.service';

const URL = `${API_BASE_URL}/api/fractions`;

describe('FractionService · portionSize', () => {
  let service: FractionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FractionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('create manda portionSize en el cuerpo de POST /api/fractions', () => {
    const payload = {
      requestId: 'r-1', productId: 10, portions: 7, price: '85.00', portionSize: '30 g',
    } as CreateFractionPayload;
    service.create(payload).subscribe();
    const req = httpMock.expectOne(URL);
    expect(req.request.body).toEqual(payload);
    expect(req.request.body.portionSize).toBe('30 g');
    req.flush({ fraction: {} as Fraction, replayed: false }, { status: 201, statusText: 'Created' });
  });
});
