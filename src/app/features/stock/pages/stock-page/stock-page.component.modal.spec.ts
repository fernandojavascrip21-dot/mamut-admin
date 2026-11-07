import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import type { ViewingSeller } from '@core/viewing/interfaces/viewing.models';
import { ViewingService } from '@core/viewing/viewing.service';
import { fractionModalLink } from '@shared/utils/modal-links';
import type { StockOverview } from '../../interfaces/stock-overview.models';
import { StockPageComponent } from './stock-page.component';

const STOCK_URL = `${API_BASE_URL}/api/stock`;

describe('StockPageComponent · «Fraccionar» abre la ventana', () => {
  let fixture: ComponentFixture<StockPageComponent>;
  let httpMock: HttpTestingController;

  it('el movimiento rápido «Fraccionar» apunta al outlet «ventana» y no a /admin/fraccionar', async () => {
    await TestBed.configureTestingModule({
      imports: [StockPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ViewingService, useValue: { selectedSeller: signal<ViewingSeller | null>(null).asReadonly() } },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StockPageComponent);
    fixture.detectChanges();
    httpMock.expectOne(STOCK_URL).flush({
      warehouse: 0, sellers: [], inactiveSellers: 0, total: 0, products: [], lowStock: [],
    } satisfies StockOverview);
    await fixture.whenStable();
    fixture.detectChanges();

    const link = (Array.from(fixture.nativeElement.querySelectorAll('a.quick-action')) as HTMLAnchorElement[]).find(
      (a) => a.textContent!.includes('Fraccionar'),
    )!;
    const router = TestBed.inject(Router);
    expect(link.getAttribute('href')).toBe(router.serializeUrl(router.createUrlTree(fractionModalLink())));
    expect(link.getAttribute('href')).not.toBe('/admin/fraccionar');
  });
});
