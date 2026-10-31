import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import { ViewingService } from '@core/viewing/viewing.service';
import type { SellerReturn } from '../../interfaces/seller.models';
import { ReturnSummaryPageComponent } from './return-summary-page.component';

const SELLER_ID = 'v-1';
const REQUEST_ID = 'r-1';
const URL = `${API_BASE_URL}/api/sellers/${SELLER_ID}/returns/${REQUEST_ID}`;

const SELLER_RETURN: SellerReturn = {
  requestId: REQUEST_ID,
  createdAt: '2026-10-31T18:21:07.000Z',
  qty: 2,
  seller: { id: SELLER_ID, fullName: 'Luis Prueba' },
  product: { id: 10, name: 'Proteína Whey 2 lb', image: null },
  sellerStock: { before: 6, after: 4 },
  warehouse: { before: 4, after: 6 },
};

describe('ReturnSummaryPageComponent', () => {
  let fixture: ComponentFixture<ReturnSummaryPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let picked: Subject<string | null>;
  let viewing: { picked: Subject<string | null>; select: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    picked = new Subject<string | null>();
    viewing = { picked, select: vi.fn() };
    const paramMap = new BehaviorSubject(convertToParamMap({ id: SELLER_ID, requestId: REQUEST_ID }));
    await TestBed.configureTestingModule({
      imports: [ReturnSummaryPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: SELLER_ID, requestId: REQUEST_ID }) },
            paramMap: paramMap.asObservable(),
          },
        },
        { provide: ViewingService, useValue: viewing },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ReturnSummaryPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');

  it('mientras carga muestra «Cargando el retiro…»', () => {
    fixture.detectChanges();
    expect(text()).toContain('Cargando el retiro…');
    httpMock.expectOne(URL).flush(SELLER_RETURN);
  });

  it('muestra el resumen con los saldos de cada lado y el total sin cambio', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(SELLER_RETURN);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root().querySelector('h1')!.textContent).toContain('Retiro registrado');
    expect(root().querySelector('.headline')!.textContent!.replace(/\s+/g, ' ')).toContain(
      'Le retiraste 2 piezas a Luis Prueba.',
    );
    expect(root().querySelector('.product-name')!.textContent).toContain('Proteína Whey 2 lb');
    expect(root().querySelector('.balances-text')!.textContent!.replace(/\s+/g, ' ')).toContain(
      'Luis Prueba: 6 → 4 · Bodega: 4 → 6. El total del negocio no cambia.',
    );
    expect(viewing.select).toHaveBeenCalledWith(SELLER_ID);
  });

  it('«Listo» vuelve al detalle y «Retirar otro producto» abre la pantalla de retiro', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(SELLER_RETURN);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root().querySelector('.done')!.getAttribute('href')).toBe('/admin/vendedores/v-1');
    expect(root().querySelector('.another')!.getAttribute('href')).toBe('/admin/vendedores/v-1/retirar');
  });

  it('un 404 muestra «No encontramos este retiro» y no cambia la barra', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush({ error: { message: 'No encontrado' } }, { status: 404, statusText: 'x' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('No encontramos este retiro');
    expect(viewing.select).not.toHaveBeenCalled();
  });

  it('un error de carga muestra «Reintentar» que vuelve a pedirlo', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush({}, { status: 500, statusText: 'x' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text()).toContain('No pudimos cargar el retiro');

    root().querySelector<HTMLButtonElement>('.retry')!.click();
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(SELLER_RETURN);
  });

  it('elegir a otro vendedor en la barra abre su detalle, y «Yo · bodega» la lista', () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(SELLER_RETURN);

    picked.next('v-2');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/vendedores/v-2');
    picked.next(null);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/vendedores');
  });
});
