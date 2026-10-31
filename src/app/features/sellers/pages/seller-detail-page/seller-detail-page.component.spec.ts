import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { ViewingService } from '@core/viewing/viewing.service';
import { SellerDetailPageComponent } from './seller-detail-page.component';
import { API_BASE_URL } from '@core/api-base-url';
import type { DeliveryHistoryItem, SellerDetail } from '../../interfaces/seller.models';

const ID = '3f2c8a1e-0000-4000-8000-000000000001';
const SELLER_URL = `${API_BASE_URL}/api/sellers/${ID}`;
const HISTORY_URL = `${SELLER_URL}/deliveries`;

const SELLER: SellerDetail = {
  id: ID,
  fullName: 'Luis Prueba',
  email: 'luis@mammut.local',
  phone: '5524681357',
  active: true,
  units: 6,
  stock: [
    {
      productId: 1, name: 'Creatina Monohidratada', image: null, units: 2, warehouseUnits: 1,
      price: '300.00', unitCost: '200.0000', unitPrice: null, unitCostWithShipping: null,
    },
    {
      productId: 2, name: 'Proteína Whey 2 lb', image: 'https://example.com/whey.jpg', units: 4, warehouseUnits: 8,
      price: '450.00', unitCost: '300.0000', unitPrice: '520.00', unitCostWithShipping: '310.5000',
    },
  ],
};

const HISTORY: DeliveryHistoryItem[] = [
  { requestId: 'r-1', createdAt: '2026-10-30T18:21:07.000Z', productId: 2, name: 'Proteína Whey 2 lb', image: null, qty: 4 },
  { requestId: null, createdAt: '2026-10-29T12:00:00.000Z', productId: 1, name: 'Creatina Monohidratada', image: null, qty: 2 },
];

describe('SellerDetailPageComponent', () => {
  let fixture: ComponentFixture<SellerDetailPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let picked: Subject<string | null>;
  let viewing: { picked: Subject<string | null>; select: ReturnType<typeof vi.fn> };
  let paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    picked = new Subject<string | null>();
    viewing = { picked, select: vi.fn() };
    paramMap = new BehaviorSubject(convertToParamMap({ id: ID }));
    await TestBed.configureTestingModule({
      imports: [SellerDetailPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: ID }) }, paramMap: paramMap.asObservable() },
        },
        { provide: ViewingService, useValue: viewing },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture = TestBed.createComponent(SellerDetailPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // Deja correr los microtasks y una vuelta del reloj: el historial se pide en cuanto el vendedor
  // carga, y fixture.whenStable() esperaría para siempre a esa petición abierta.
  async function tick() {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  // Carga el detalle y, ya con el vendedor en pantalla, «Últimas entregas» (se pide después).
  async function load(seller: SellerDetail, history: DeliveryHistoryItem[] = []) {
    fixture.detectChanges();
    httpMock.expectOne(SELLER_URL).flush(seller);
    await tick();
    httpMock.expectOne(HISTORY_URL).flush(history);
    await settle();
  }

  const text = () => fixture.nativeElement.textContent as string;

  it('mientras carga muestra «Cargando vendedor…»', async () => {
    fixture.detectChanges();
    expect(text()).toContain('Cargando vendedor…');
    httpMock.expectOne(SELLER_URL).flush(SELLER);
    await tick();
    httpMock.expectOne(HISTORY_URL).flush([]);
  });

  it('muestra sus datos con el teléfono formateado, su total y su stock por producto', async () => {
    await load(SELLER);

    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Luis Prueba');
    expect(fixture.nativeElement.querySelector('.phone').textContent.trim()).toBe('55 2468 1357');
    expect(text()).toContain('luis@mammut.local');
    expect(fixture.nativeElement.querySelector('.total').textContent.trim()).toBe('6 piezas');

    const lines = Array.from(fixture.nativeElement.querySelectorAll('app-seller-stock-line')) as HTMLElement[];
    expect(lines).toHaveLength(2);
    expect(lines[0].textContent).toContain('Creatina Monohidratada');
    expect(lines[0].textContent).toContain('2 piezas');
    expect(lines[1].textContent).toContain('4 piezas');
  });

  it('sin productos muestra «Todavía no tiene producto.»', async () => {
    await load({ ...SELLER, units: 0, stock: [] });

    expect(fixture.nativeElement.querySelector('.empty').textContent.trim()).toBe('Todavía no tiene producto.');
    expect(fixture.nativeElement.querySelector('.total').textContent.trim()).toBe('0 piezas');
  });

  it('con un 404 muestra «No encontramos a este vendedor» y un enlace a la lista', async () => {
    fixture.detectChanges();
    httpMock.expectOne(SELLER_URL).flush({}, { status: 404, statusText: 'Not Found' });
    await settle();

    expect(text()).toContain('No encontramos a este vendedor');
    expect(fixture.nativeElement.querySelector('.retry')).toBeNull();
    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.some((a) => a.textContent?.includes('Volver a Mis vendedores'))).toBe(true);
  });

  it('si falla la carga muestra el error, y «Reintentar» vuelve a pedirlo', async () => {
    fixture.detectChanges();
    httpMock.expectOne(SELLER_URL).error(new ProgressEvent('error'));
    await settle();

    expect(text()).toContain('No pudimos cargar al vendedor');
    (fixture.nativeElement.querySelector('.retry') as HTMLButtonElement).click();
    fixture.detectChanges();

    httpMock.expectOne(SELLER_URL).flush(SELLER);
    await tick();
    httpMock.expectOne(HISTORY_URL).flush([]);
    await settle();
    expect(fixture.nativeElement.querySelectorAll('app-seller-stock-line')).toHaveLength(2);
  });

  describe('dejar producto y últimas entregas (HU-11)', () => {
    it('«Dejar producto» abre la ventana con el vendedor fijo y regresa al detalle', async () => {
      await load(SELLER);
      const link = fixture.nativeElement.querySelector('a.deliver') as HTMLAnchorElement;
      expect(link.textContent?.trim()).toBe('Dejar producto');
      expect(link.getAttribute('href')).toBe(`/admin/entregas/nueva?vendedor=${ID}&volver=vendedor`);
    });

    it('lista las entregas, con enlace al resumen solo si tienen requestId', async () => {
      await load(SELLER, HISTORY);
      const items = Array.from(fixture.nativeElement.querySelectorAll('app-delivery-history-line')) as HTMLElement[];
      expect(items).toHaveLength(2);
      expect(items[0].textContent).toContain('Proteína Whey 2 lb');
      expect(items[0].textContent).toContain('+4 piezas');
      expect(items[0].querySelector('a')?.getAttribute('href')).toBe('/admin/entregas/r-1?volver=vendedor');
      expect(items[1].querySelector('a')).toBeNull();
    });

    it('sin entregas muestra «Todavía no le has dejado producto.»', async () => {
      await load(SELLER, []);
      expect(fixture.nativeElement.querySelector('.history-empty').textContent.trim()).toBe(
        'Todavía no le has dejado producto.',
      );
    });

    it('si falla el historial lo avisa sin esconder el detalle, y «Reintentar» lo vuelve a pedir', async () => {
      fixture.detectChanges();
      httpMock.expectOne(SELLER_URL).flush(SELLER);
      await tick();
      httpMock.expectOne(HISTORY_URL).error(new ProgressEvent('error'));
      await settle();

      expect(fixture.nativeElement.querySelector('.history-error')).not.toBeNull();
      expect(fixture.nativeElement.querySelectorAll('app-seller-stock-line')).toHaveLength(2);
      (fixture.nativeElement.querySelector('.retry-history') as HTMLButtonElement).click();
      fixture.detectChanges();
      httpMock.expectOne(HISTORY_URL).flush(HISTORY);
      await settle();
      expect(fixture.nativeElement.querySelectorAll('app-delivery-history-line')).toHaveLength(2);
    });
  });

  describe('con la barra «Viendo»', () => {
    it('con el detalle cargado elige a ese vendedor en la barra', async () => {
      await load(SELLER);
      expect(viewing.select).toHaveBeenCalledWith(ID);
    });

    it('con un 404 no cambia la barra', async () => {
      fixture.detectChanges();
      httpMock.expectOne(SELLER_URL).flush({}, { status: 404, statusText: 'Not Found' });
      await settle();
      expect(viewing.select).not.toHaveBeenCalled();
    });

    it('elegir a otro vendedor abre su detalle, y «Yo · bodega» regresa a la lista', async () => {
      await load(SELLER);
      picked.next('otro-id');
      expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/vendedores/otro-id');
      picked.next(null);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/vendedores');
    });

    it('al cambiar el :id en la misma página pide al vendedor nuevo', async () => {
      await load(SELLER);
      const otherId = '3f2c8a1e-0000-4000-8000-000000000002';
      paramMap.next(convertToParamMap({ id: otherId }));
      fixture.detectChanges();
      httpMock.expectOne(`${API_BASE_URL}/api/sellers/${otherId}`).flush({ ...SELLER, id: otherId, fullName: 'Valeria' });
      await tick();
      httpMock.expectOne(`${API_BASE_URL}/api/sellers/${otherId}/deliveries`).flush([]);
      await settle();
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Valeria');
      expect(viewing.select).toHaveBeenLastCalledWith(otherId);
    });
  });
});
