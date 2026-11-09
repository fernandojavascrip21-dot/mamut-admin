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

describe('StockPageComponent · selector de vista (HU-26 §12)', () => {
  let fixture: ComponentFixture<StockPageComponent>;
  let httpMock: HttpTestingController;
  let selected: ReturnType<typeof signal<ViewingSeller | null>>;
  const el = () => fixture.nativeElement as HTMLElement;
  const labels = () => Array.from(el().querySelectorAll('p-selectbutton p-togglebutton')).map((o) => o.textContent!.trim());

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

  it('con «Yo · bodega» el selector ofrece Productos, Mermas y Fraccionados y ya no hay enlace «Ver fraccionados»', async () => {
    await load();
    expect(labels()).toEqual(['Productos', 'Mermas', 'Fraccionados']);
    expect(Array.from(el().querySelectorAll('a')).map((a) => a.textContent!.trim())).not.toContain('Ver fraccionados');
  });

  it('con un vendedor en «Viendo» el selector también ofrece «Fraccionados» (HU-26 §13)', async () => {
    selected.set({ id: 'luis-id', fullName: 'Luis' });
    await load();
    expect(labels()).toEqual(['Productos', 'Mermas', 'Fraccionados']);
  });

  it('sigue habiendo seis movimientos rápidos y el selector no es uno de ellos', async () => {
    await load();
    const links = Array.from(el().querySelectorAll('a.quick-action')).map((a) => a.textContent!.trim());
    expect(links).toHaveLength(6);
    expect(links).not.toContain('Fraccionados');
  });
});
