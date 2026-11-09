import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import { ViewingService } from '@core/viewing/viewing.service';
import type { ViewingSeller } from '@core/viewing/interfaces/viewing.models';
import type { StockOverview } from '../../interfaces/stock-overview.models';
import { StockPageComponent } from './stock-page.component';

const STOCK_URL = `${API_BASE_URL}/api/stock`;
const OVERVIEW: StockOverview = {
  warehouse: 8,
  sellers: [{ id: 'luis-id', fullName: 'Luis', units: 0 }],
  inactiveSellers: 0,
  total: 8,
  products: [
    { productId: 1, name: 'Creatina', image: null, warehouse: 8, warehouseLevel: 'ok', sellers: [], inactiveSellers: 0, total: 8 },
  ],
  lowStock: [],
};

describe('StockPageComponent · enlace «Ver fraccionados» (HU-24)', () => {
  let fixture: ComponentFixture<StockPageComponent>;
  let httpMock: HttpTestingController;
  let selected: ReturnType<typeof signal<ViewingSeller | null>>;
  const el = () => fixture.nativeElement as HTMLElement;
  const option = (label: string) =>
    Array.from(el().querySelectorAll('p-selectbutton p-togglebutton')).find((o) => o.textContent!.trim() === label) as HTMLElement;
  const historyLinks = () =>
    Array.from(el().querySelectorAll('a')).filter((a) => a.textContent!.trim() === 'Ver fraccionados');

  async function load() {
    fixture.detectChanges();
    httpMock.expectOne(STOCK_URL).flush(OVERVIEW);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    selected = signal<ViewingSeller | null>(null);
    await TestBed.configureTestingModule({
      imports: [StockPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin/stock', component: StockPageComponent }]),
        { provide: ViewingService, useValue: { selectedSeller: selected.asReadonly() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(StockPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  it('elegir «Mermas» pone ?vista=mermas en la URL y pide /api/shrinkages', async () => {
    await load();
    option('Mermas').click();
    await new Promise((resolve) => setTimeout(resolve));
    expect(TestBed.inject(Router).url).toContain('vista=mermas');
    httpMock.expectOne((r) => r.url === `${API_BASE_URL}/api/shrinkages`).flush([]);
  });

  it('ya no hay enlace «Ver mermas» con «Yo · bodega» ni con un vendedor', async () => {
    await load();
    const labelsOf = () => Array.from(el().querySelectorAll('a')).map((a) => a.textContent!.trim());
    expect(labelsOf()).not.toContain('Ver mermas');
    selected.set({ id: 'luis-id', fullName: 'Luis' });
    fixture.detectChanges();
    expect(labelsOf()).not.toContain('Ver mermas');
  });

  it('los movimientos rápidos no cambian: seis con «Yo · bodega»', async () => {
    await load();
    expect(el().querySelectorAll('a.quick-action')).toHaveLength(6);
  });
});
