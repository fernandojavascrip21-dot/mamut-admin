import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { CashCut } from '../interfaces/cash-cut.models';
import { CashCutService } from './cash-cut.service';

describe('CashCutService · corte para casa', () => {
  let service: CashCutService;
  let httpMock: HttpTestingController;
  const cut = { totals: { salesCount: 1 } } as CashCut;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CashCutService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getHome() pide /api/cuts con type=home, holderId, period y date y devuelve el corte', () => {
    let received: CashCut | undefined;
    service
      .getHome({ holderId: 'abc', period: 'week', date: '2026-11-02' })
      .subscribe((r) => (received = r));
    const req = httpMock.expectOne((r) => r.url === `${API_BASE_URL}/api/cuts`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('type')).toBe('home');
    expect(req.request.params.get('holderId')).toBe('abc');
    expect(req.request.params.get('period')).toBe('week');
    expect(req.request.params.get('date')).toBe('2026-11-02');
    req.flush({ cut });
    expect(received).toEqual(cut);
  });

  it('getHome() no manda holderId para «Yo · bodega» pero sí type=home', () => {
    service.getHome({ holderId: null, period: 'day', date: '2026-11-05' }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${API_BASE_URL}/api/cuts`);
    expect(req.request.params.has('holderId')).toBe(false);
    expect(req.request.params.get('type')).toBe('home');
    expect(req.request.params.get('period')).toBe('day');
    expect(req.request.params.get('date')).toBe('2026-11-05');
    req.flush({ cut });
  });

  it('get() no manda type: el corte con precios no cambia', () => {
    service.get({ holderId: 'abc', period: 'week', date: '2026-11-02' }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${API_BASE_URL}/api/cuts`);
    expect(req.request.params.has('type')).toBe(false);
    expect(req.request.params.get('holderId')).toBe('abc');
    req.flush({ cut });
  });
});
