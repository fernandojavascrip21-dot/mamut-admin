import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
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
        provideRouter([]),
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

  it('con «Yo · bodega» muestra «Ver fraccionados» hacia /admin/fraccionados', async () => {
    await load();
    expect(historyLinks()).toHaveLength(1);
    expect(historyLinks()[0]!.getAttribute('href')).toBe('/admin/fraccionados');
  });

  it('con un vendedor en «Viendo» no muestra «Ver fraccionados»', async () => {
    selected.set({ id: 'luis-id', fullName: 'Luis' });
    await load();
    expect(historyLinks()).toHaveLength(0);
  });

  it('sigue habiendo cinco movimientos rápidos y el enlace no es uno de ellos', async () => {
    await load();
    const labels = Array.from(el().querySelectorAll('a.quick-action')).map((a) => a.textContent!.trim());
    expect(labels).toHaveLength(5);
    expect(labels).not.toContain('Ver fraccionados');
  });
});
