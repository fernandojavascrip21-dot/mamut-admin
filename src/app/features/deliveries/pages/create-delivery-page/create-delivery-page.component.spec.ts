import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import { ToastService } from '@core/toast/toast.service';
import type { ViewingListStatus } from '@core/viewing/interfaces/viewing.models';
import { ViewingService } from '@core/viewing/viewing.service';
import type {
  Delivery, DeliveryProduct, DeliveryProductSummary, SellerHolding,
} from '../../interfaces/delivery.models';
import { CreateDeliveryPageComponent } from './create-delivery-page.component';

const SELLER_ID = '3f2c8a1e-0000-4000-8000-000000000001';
const PRODUCTS_URL = `${API_BASE_URL}/api/products`;
const PRODUCT_URL = `${PRODUCTS_URL}/10`;
const HOLDING_URL = `${API_BASE_URL}/api/sellers/${SELLER_ID}/stock/10`;
const DELIVERIES_URL = `${API_BASE_URL}/api/sellers/${SELLER_ID}/deliveries`;

const PRODUCT: DeliveryProduct = { id: 10, name: 'Proteína Whey', image: '', stock: 10, price: '450.00', unitCost: '300.0000' };
const SUMMARIES: DeliveryProductSummary[] = [
  { id: 10, name: 'Proteína Whey', image: '', stock: 10, price: '450.00' },
  { id: 11, name: 'Agotado', image: '', stock: 0, price: '100.00' },
];
const HOLDING: SellerHolding = { units: 2, unitPrice: '500.00', unitCostWithShipping: null };
const DELIVERY: Delivery = {
  requestId: 'r-1',
  createdAt: '2026-10-30T18:21:07.000Z',
  qty: 6,
  seller: { id: SELLER_ID, fullName: 'Luis Pérez' },
  product: { id: 10, name: 'Proteína Whey', image: null, price: '450.00', unitCost: '300.0000' },
  unitPrice: '500.00',
  unitCostWithShipping: null,
  warehouse: { before: 10, after: 4 },
  sellerStock: { before: 2, after: 8 },
};

describe('CreateDeliveryPageComponent', () => {
  let fixture: ComponentFixture<CreateDeliveryPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let toast: ToastService;
  let viewing: {
    sellers: ReturnType<typeof signal<{ id: string; fullName: string }[]>>;
    listStatus: ReturnType<typeof signal<ViewingListStatus>>;
    load: ReturnType<typeof vi.fn>;
    reload: ReturnType<typeof vi.fn>;
  };

  function setup(query: Record<string, string>) {
    viewing = {
      sellers: signal([{ id: SELLER_ID, fullName: 'Luis Pérez' }]),
      listStatus: signal<ViewingListStatus>('ready'),
      load: vi.fn(),
      reload: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [CreateDeliveryPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
        { provide: ViewingService, useValue: viewing },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CreateDeliveryPageComponent);
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }
  function type(selector: string, value: string) {
    const input = el().querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
  const submit = () => {
    (el().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  // Abre la ventana con producto y vendedor fijos (la ruta que usa el detalle del vendedor).
  async function openFixed(volver = 'vendedor') {
    setup({ producto: '10', vendedor: SELLER_ID, volver });
    fixture.detectChanges();
    httpMock.expectOne(PRODUCT_URL).flush(PRODUCT);
    httpMock.expectOne(HOLDING_URL).flush(HOLDING);
    await settle();
  }

  afterEach(() => httpMock.verify());

  it('pide la lista de vendedores de la barra al entrar', async () => {
    setup({ producto: '10', vendedor: SELLER_ID });
    fixture.detectChanges();
    expect(viewing.load).toHaveBeenCalled();
    httpMock.expectOne(PRODUCT_URL).flush(PRODUCT);
    httpMock.expectOne(HOLDING_URL).flush(HOLDING);
    await settle();
  });

  it('mientras cargan los vendedores o el producto muestra «Cargando…»', async () => {
    setup({ producto: '10', vendedor: SELLER_ID });
    viewing.listStatus.set('loading');
    fixture.detectChanges();
    expect(text()).toContain('Cargando…');
    expect(el().querySelector('app-delivery-form')).toBeNull();
    viewing.listStatus.set('ready');
    fixture.detectChanges();
    expect(text()).toContain('Cargando…');
    httpMock.expectOne(PRODUCT_URL).flush(PRODUCT);
    httpMock.expectOne(HOLDING_URL).flush(HOLDING);
    await settle();
    expect(el().querySelector('app-delivery-form')).not.toBeNull();
  });

  it('con producto y vendedor fijos muestra el formulario prellenado con lo que ya tiene el vendedor', async () => {
    await openFixed();
    expect(el().querySelector('.seller-fixed')!.textContent!.trim()).toBe('Luis Pérez');
    expect(text()).toContain('Proteína Whey');
    expect((el().querySelector('#unit-price') as HTMLInputElement).value).toBe('500.00');
    expect((el().querySelector('#unit-cost') as HTMLInputElement).value).toBe('');
  });

  it('«Cancelar» regresa al detalle del vendedor con volver=vendedor, y a Productos con un valor desconocido', async () => {
    await openFixed('vendedor');
    const cancel = () =>
      Array.from(el().querySelectorAll('a')).find((a) => a.textContent!.includes('Cancelar'))!.getAttribute('href');
    expect(cancel()).toBe(`/admin/vendedores/${SELLER_ID}`);
  });

  it('un volver desconocido regresa a Productos', async () => {
    await openFixed('https://malo.test');
    const cancel = Array.from(el().querySelectorAll('a')).find((a) => a.textContent!.includes('Cancelar'))!;
    expect(cancel.getAttribute('href')).toBe('/admin/productos');
  });

  it('sin producto en la URL pide la lista, la ofrece en el buscador y al elegir uno pide su detalle', async () => {
    setup({ vendedor: SELLER_ID, volver: 'productos' });
    fixture.detectChanges();
    httpMock.expectOne(PRODUCTS_URL).flush(SUMMARIES);
    await settle();

    expect(el().querySelectorAll('.option')).toHaveLength(1);
    (el().querySelector('.option') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne(PRODUCT_URL).flush(PRODUCT);
    httpMock.expectOne(HOLDING_URL).flush(HOLDING);
    await settle();
    expect(el().querySelector('.product-card')).not.toBeNull();

    // «Cambiar» vuelve al buscador sin pedir otra lista.
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.includes('Cambiar'))!.click();
    fixture.detectChanges();
    expect(el().querySelector('app-delivery-product-picker')).not.toBeNull();
  });

  it('confirma: manda el cuerpo, avisa con un toast y navega al resumen', async () => {
    await openFixed();
    type('#qty', '6');
    submit();

    const req = httpMock.expectOne(DELIVERIES_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ productId: 10, qty: 6, unitPrice: '500.00', unitCostWithShipping: null });
    expect(req.request.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(el().querySelector('button[type="submit"]')!.textContent!.trim()).toBe('Dejando…');
    req.flush(DELIVERY, { status: 201, statusText: 'Created' });
    await settle();

    expect(toast.success).toHaveBeenCalledWith('Le dejaste 6 piezas a Luis Pérez');
    expect(router.navigate).toHaveBeenCalledWith(['/admin/entregas', 'r-1'], { queryParams: { volver: 'vendedor' } });
  });

  it('ignora un segundo envío mientras el primero sigue en curso', async () => {
    await openFixed();
    type('#qty', '6');
    submit();
    submit();
    const reqs = httpMock.match(DELIVERIES_URL);
    expect(reqs).toHaveLength(1);
    reqs[0].flush(DELIVERY);
    await settle();
  });

  it('más piezas que la bodega según el servidor (409) se muestra en el campo y no navega', async () => {
    await openFixed();
    type('#qty', '6');
    submit();
    httpMock
      .expectOne(DELIVERIES_URL)
      .flush({ error: { code: 'conflict', message: 'No hay piezas suficientes' } }, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(el().querySelector('.field-error')!.textContent!.trim()).toBe('No hay piezas suficientes');
    expect(toast.error).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('sin conexión muestra «Reintentar», que reenvía el mismo requestId', async () => {
    await openFixed();
    type('#qty', '6');
    submit();
    const first = httpMock.expectOne(DELIVERIES_URL);
    const requestId = first.request.body.requestId;
    first.error(new ProgressEvent('error'));
    await settle();

    expect(el().querySelector('.offline')).not.toBeNull();
    expect(text()).toContain('No pudimos registrar la entrega');
    (el().querySelector('.offline .retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    const second = httpMock.expectOne(DELIVERIES_URL);
    expect(second.request.body.requestId).toBe(requestId);
    second.flush(DELIVERY);
    await settle();
    expect(router.navigate).toHaveBeenCalled();
  });

  it('un 409 por otros datos con la misma llave queda como aviso fijo', async () => {
    await openFixed();
    type('#qty', '6');
    submit();
    httpMock
      .expectOne(DELIVERIES_URL)
      .flush({ error: { code: 'conflict', message: 'Esta entrega ya se registró con otros datos. Revisa el detalle del vendedor.' } }, { status: 409, statusText: 'Conflict' });
    await settle();
    expect(el().querySelector('.failure')!.textContent).toContain('ya se registró con otros datos');
    expect(el().querySelector('.offline')).toBeNull();
  });

  it('un vendedor de la URL que no está en la lista da «No encontramos el producto o al vendedor»', async () => {
    setup({ producto: '10', vendedor: 'otro-id' });
    fixture.detectChanges();
    httpMock.expectOne(PRODUCT_URL).flush(PRODUCT);
    await settle();
    expect(text()).toContain('No encontramos el producto o al vendedor');
    expect(el().querySelector('app-delivery-form')).toBeNull();
  });

  it('un producto de la URL que da 404 (archivado o inexistente) también', async () => {
    setup({ producto: '10', vendedor: SELLER_ID });
    fixture.detectChanges();
    httpMock.expectOne(PRODUCT_URL).flush({}, { status: 404, statusText: 'Not Found' });
    httpMock.expectOne(HOLDING_URL).flush({}, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(text()).toContain('No encontramos el producto o al vendedor');
  });

  it('si falla la lista de productos muestra el error, y «Reintentar» la vuelve a pedir', async () => {
    setup({ vendedor: SELLER_ID });
    fixture.detectChanges();
    httpMock.expectOne(PRODUCTS_URL).error(new ProgressEvent('error'));
    await settle();
    expect(text()).toContain('No pudimos cargar los datos de la entrega');

    (el().querySelector('.retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(viewing.reload).toHaveBeenCalled();
    httpMock.expectOne(PRODUCTS_URL).flush(SUMMARIES);
    await settle();
    expect(el().querySelector('app-delivery-form')).not.toBeNull();
  });

  it('si falla lo que ya tiene el vendedor bloquea el envío y «Reintentar» lo vuelve a pedir', async () => {
    setup({ producto: '10', vendedor: SELLER_ID });
    fixture.detectChanges();
    httpMock.expectOne(PRODUCT_URL).flush(PRODUCT);
    httpMock.expectOne(HOLDING_URL).error(new ProgressEvent('error'));
    await settle();

    expect(el().querySelector('.holding-error')).not.toBeNull();
    expect((el().querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    (el().querySelector('.holding-error button') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne(HOLDING_URL).flush(HOLDING);
    await settle();
    expect((el().querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true); // sin piezas
    type('#qty', '1');
    expect((el().querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
  });
});
