import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ToastService } from '@core/toast/toast.service';
import type { ViewingListStatus } from '@core/viewing/interfaces/viewing.models';
import { ViewingService } from '@core/viewing/viewing.service';
import { closeModalLink } from '@shared/utils/modal-links';
import type { DeliveryProduct, SellerHolding } from '../../interfaces/delivery.models';
import { EditHoldingPageComponent } from './edit-holding-page.component';

const SELLER_ID = '3f2c8a1e-0000-4000-8000-000000000001';
const PRODUCT_URL = `${API_BASE_URL}/api/products/10`;
const HOLDING_URL = `${API_BASE_URL}/api/sellers/${SELLER_ID}/stock/10`;

const PRODUCT: DeliveryProduct = { id: 10, name: 'Proteína Whey', image: '', stock: 10, price: '450.00', unitCost: '300.0000' };
const HOLDING: SellerHolding = { units: 3, unitPrice: '500.00', unitCostWithShipping: null };

describe('EditHoldingPageComponent', () => {
  let fixture: ComponentFixture<EditHoldingPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let toast: ToastService;
  let stockChanges: StockChangesService;
  let viewing: {
    sellers: ReturnType<typeof signal<{ id: string; fullName: string }[]>>;
    listStatus: ReturnType<typeof signal<ViewingListStatus>>;
    load: ReturnType<typeof vi.fn>;
    reload: ReturnType<typeof vi.fn>;
  };

  function setup(params: Record<string, string>) {
    viewing = {
      sellers: signal([{ id: SELLER_ID, fullName: 'Luis Pérez' }]),
      listStatus: signal<ViewingListStatus>('ready'),
      load: vi.fn(),
      reload: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [EditHoldingPageComponent],
      providers: [
        MessageService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(params) } } },
        { provide: ViewingService, useValue: viewing },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
    stockChanges = TestBed.inject(StockChangesService);
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EditHoldingPageComponent);
  }

  // El diálogo de PrimeNG se monta en body: el contenido ya no cuelga del fixture.
  const el = () => document.body;
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

  async function open() {
    setup({ sellerId: SELLER_ID, productId: '10' });
    fixture.detectChanges();
    httpMock.expectOne(PRODUCT_URL).flush(PRODUCT);
    httpMock.expectOne(HOLDING_URL).flush(HOLDING);
    await settle();
  }

  afterEach(() => {
    httpMock.verify();
    document.body.querySelectorAll('.p-dialog-mask, p-dialog').forEach((node) => node.remove());
  });

  it('carga el producto y lo que tiene el vendedor, y muestra el formulario prellenado', async () => {
    await open();
    expect(text()).toContain('Editar lo dejado');
    expect((el().querySelector('#qty') as HTMLInputElement).value).toBe('3');
    expect((el().querySelector('#unit-price') as HTMLInputElement).value).toBe('500.00');
  });

  it('guarda con PATCH, avisa, notifica el cambio de inventario y cierra', async () => {
    await open();
    type('#qty', '5');
    submit();
    const req = httpMock.expectOne(HOLDING_URL);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ qty: 5, unitPrice: '500.00', unitCostWithShipping: null });
    const before = stockChanges.version();
    req.flush({ units: 5, unitPrice: '500.00', unitCostWithShipping: null });
    await settle();
    expect(toast.success).toHaveBeenCalledWith('Actualizaste lo que tiene Luis Pérez');
    expect(stockChanges.version()).toBe(before + 1);
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });

  it('un 409 por piezas marca el campo y no cierra', async () => {
    await open();
    type('#qty', '9');
    submit();
    httpMock
      .expectOne(HOLDING_URL)
      .flush({ error: { code: 'conflict', message: 'No hay piezas suficientes' } }, { status: 409, statusText: 'Conflict' });
    await settle();
    expect(toast.error).toHaveBeenCalledWith('No hay piezas suficientes en la bodega.');
    expect(text()).toContain('No hay piezas suficientes');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('sin red muestra «Reintentar» y reenvía lo mismo', async () => {
    await open();
    type('#qty', '4');
    submit();
    httpMock.expectOne(HOLDING_URL).error(new ProgressEvent('error'));
    await settle();
    expect(el().querySelector('.offline')).not.toBeNull();

    (el().querySelector('.offline .retry') as HTMLButtonElement).click();
    const retry = httpMock.expectOne(HOLDING_URL);
    expect(retry.request.body).toMatchObject({ qty: 4 });
    retry.flush({ units: 4, unitPrice: '500.00', unitCostWithShipping: null });
    await settle();
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });

  it('un 404 al guardar queda como aviso fijo', async () => {
    await open();
    type('#qty', '4');
    submit();
    httpMock.expectOne(HOLDING_URL).flush({ error: { code: 'not_found', message: 'No existe' } }, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(el().querySelector('.failure')).not.toBeNull();
  });

  it('un vendedor que no está en la lista da «no encontramos» sin pedir su stock', async () => {
    setup({ sellerId: 'otro', productId: '10' });
    fixture.detectChanges();
    httpMock.expectOne(PRODUCT_URL).flush(PRODUCT);
    await settle();
    expect(text()).toContain('No encontramos el producto o al vendedor');
  });

  it('un producto que no existe (404) da «no encontramos»', async () => {
    setup({ sellerId: SELLER_ID, productId: '10' });
    fixture.detectChanges();
    httpMock.expectOne(PRODUCT_URL).flush({ error: { code: 'not_found', message: 'x' } }, { status: 404, statusText: 'Not Found' });
    httpMock.expectOne(HOLDING_URL).flush(HOLDING);
    await settle();
    expect(text()).toContain('No encontramos el producto o al vendedor');
  });

  it('un id de producto inválido da «no encontramos» sin pedir nada', async () => {
    setup({ sellerId: SELLER_ID, productId: 'abc' });
    fixture.detectChanges();
    await settle();
    expect(text()).toContain('No encontramos el producto o al vendedor');
  });

  it('un fallo de carga ofrece «Reintentar»', async () => {
    setup({ sellerId: SELLER_ID, productId: '10' });
    fixture.detectChanges();
    httpMock.expectOne(PRODUCT_URL).error(new ProgressEvent('error'));
    httpMock.expectOne(HOLDING_URL).flush(HOLDING);
    await settle();
    expect(text()).toContain('No pudimos cargar los datos');
    (el().querySelector('.retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    httpMock.expectOne(PRODUCT_URL).flush(PRODUCT);
    httpMock.expectOne(HOLDING_URL).flush(HOLDING);
    await settle();
    expect(el().querySelector('#qty')).not.toBeNull();
  });
});
