import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { CashCut } from '../interfaces/cash-cut.models';
import { CashCutService } from './cash-cut.service';

describe('CashCutService', () => {
  let service: CashCutService;
  let httpMock: HttpTestingController;
  const cut = { totals: { salesCount: 0 } } as CashCut;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CashCutService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('get() pide /api/cuts con holderId, period y date y devuelve el corte', () => {
    let received: CashCut | undefined;
    service.get({ holderId: 'abc', period: 'week', date: '2026-11-02' }).subscribe((r) => (received = r));
    const req = httpMock.expectOne((r) => r.url === `${API_BASE_URL}/api/cuts`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('holderId')).toBe('abc');
    expect(req.request.params.get('period')).toBe('week');
    expect(req.request.params.get('date')).toBe('2026-11-02');
    req.flush({ cut });
    expect(received).toEqual(cut);
  });

  it('get() no manda holderId para la bodega', () => {
    service.get({ holderId: null, period: 'day', date: '2026-11-03' }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${API_BASE_URL}/api/cuts`);
    expect(req.request.params.has('holderId')).toBe(false);
    expect(req.request.params.get('period')).toBe('day');
    req.flush({ cut });
  });
});
