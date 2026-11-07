import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { BusinessCutHolder, CashCut, CashCutQuery } from '../interfaces/cash-cut.models';
import { CashCutService } from './cash-cut.service';

describe('CashCutService · resumen del negocio', () => {
  let service: CashCutService;
  let httpMock: HttpTestingController;

  const holders: BusinessCutHolder[] = [
    {
      holder: null,
      salesCount: 1,
      units: 2,
      total: '500.00',
      factoryCost: '312.50',
      realProfit: '187.50',
      shippingCover: '0.00',
    },
    {
      holder: { id: 'a0000000-0000-0000-0000-000000000002', fullName: 'Luis Vendedor', active: false },
      salesCount: 3,
      units: 5,
      total: '1840.00',
      factoryCost: '1200.00',
      realProfit: '640.00',
      shippingCover: '200.00',
    },
  ];

  const cut: CashCut = {
    holder: null,
    period: { kind: 'week', from: '2026-11-02', to: '2026-11-08', timeZone: 'America/Mexico_City' },
    totals: {
      salesCount: 4,
      units: 7,
      total: '2340.00',
      factoryCost: '1512.50',
      realProfit: '827.50',
      shippingCover: '200.00',
    },
    products: [],
    sales: [],
    holders,
  };

  const isCutsUrl = (url: string) => url === `${API_BASE_URL}/api/cuts`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CashCutService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getBusiness() pide GET /api/cuts con type=home, scope=business, period y date', () => {
    service.getBusiness({ period: 'week', date: '2026-11-02' }).subscribe();
    const req = httpMock.expectOne((r) => isCutsUrl(r.url));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('type')).toBe('home');
    expect(req.request.params.get('scope')).toBe('business');
    expect(req.request.params.get('period')).toBe('week');
    expect(req.request.params.get('date')).toBe('2026-11-02');
    expect(req.request.params.has('holderId')).toBe(false);
    req.flush({ cut });
  });

  it('getBusiness() no manda holderId aunque la consulta traiga uno', () => {
    const query: CashCutQuery = { holderId: 'abc', period: 'month', date: '2026-11-05' };
    service.getBusiness(query).subscribe();
    const req = httpMock.expectOne((r) => isCutsUrl(r.url));
    expect(req.request.params.has('holderId')).toBe(false);
    expect(req.request.params.get('scope')).toBe('business');
    expect(req.request.params.get('type')).toBe('home');
    expect(req.request.params.get('period')).toBe('month');
    expect(req.request.params.get('date')).toBe('2026-11-05');
    req.flush({ cut });
  });

  it('getBusiness() devuelve el corte desenvuelto de { cut }, con los totales y los titulares', () => {
    let received: CashCut | undefined;
    service.getBusiness({ period: 'week', date: '2026-11-02' }).subscribe((r) => (received = r));
    httpMock.expectOne((r) => isCutsUrl(r.url)).flush({ cut });
    expect(received).toEqual(cut);
    expect(received?.totals.total).toBe('2340.00');
    expect(received?.totals.realProfit).toBe('827.50');
    expect(received?.holders).toEqual(holders);
    expect(received?.holders?.[0].holder).toBeNull();
    expect(received?.holders?.[1].holder?.fullName).toBe('Luis Vendedor');
    expect(received?.holders?.[1].holder?.active).toBe(false);
    expect(received?.holders?.[1].total).toBe('1840.00');
  });

  it('getBusiness() propaga el error HTTP al suscriptor', () => {
    let status: number | undefined;
    service.getBusiness({ period: 'day', date: '2026-11-05' }).subscribe({
      error: (e: { status: number }) => (status = e.status),
    });
    httpMock
      .expectOne((r) => isCutsUrl(r.url))
      .flush(
        { error: { code: 'forbidden', message: 'No autorizado' } },
        { status: 403, statusText: 'Forbidden' },
      );
    expect(status).toBe(403);
  });

  it('getHome() sigue sin mandar scope', () => {
    service.getHome({ holderId: null, period: 'week', date: '2026-11-02' }).subscribe();
    const req = httpMock.expectOne((r) => isCutsUrl(r.url));
    expect(req.request.params.get('type')).toBe('home');
    expect(req.request.params.has('scope')).toBe(false);
    req.flush({ cut });
  });

  it('get() sigue sin mandar type ni scope', () => {
    service.get({ holderId: null, period: 'week', date: '2026-11-02' }).subscribe();
    const req = httpMock.expectOne((r) => isCutsUrl(r.url));
    expect(req.request.params.has('type')).toBe(false);
    expect(req.request.params.has('scope')).toBe(false);
    req.flush({ cut });
  });
});
