import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { API_BASE_URL } from '@core/api-base-url';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ToastService } from '@core/toast/toast.service';
import { closeModalLink } from '@shared/utils/modal-links';
import type { Purchase, PurchaseProduct } from '../../interfaces/purchase.models';
import { PurchasePageComponent } from './purchase-page.component';

const PRODUCTS_URL = `${API_BASE_URL}/api/products`;
const CREATE_URL = `${API_BASE_URL}/api/purchases`;
const PRODUCTS: PurchaseProduct[] = [{ id: 10, name: 'Creatina 300 g', image: null, stock: 3, parentProductId: null }];
const PURCHASE: Purchase = {
  requestId: 'r-1',
  createdAt: '2026-11-09T10:00:00Z',
  qty: 5,
  product: { id: 10, name: 'Creatina 300 g', image: null },
  stock: { before: 3, after: 8 },
};

describe('PurchasePageComponent', () => {
  let fixture: ComponentFixture<PurchasePageComponent>;
  let httpMock: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let router: Router;
  let stockChanges: StockChangesService;

  const root = () => document.body;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.includes(label))!;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const setup = async () => {
    toast = { success: vi.fn(), error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [PurchasePageComponent],
      providers: [
        MessageService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    stockChanges = TestBed.inject(StockChangesService);
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PurchasePageComponent);
  };
  const load = async (products: PurchaseProduct[] = PRODUCTS) => {
    fixture.detectChanges();
    httpMock.expectOne(PRODUCTS_URL).flush(products);
    await settle();
  };
  const fill = async (qty = '5') => {
    root().querySelector<HTMLElement>('p-select')!.click();
    await settle();
    Array.from(root().querySelectorAll<HTMLElement>('li.p-select-option'))
      .find((li) => li.textContent!.includes('Creatina 300 g'))!.click();
    await settle();
    const input = root().querySelector<HTMLInputElement>('#qty')!;
    input.value = qty;
    input.dispatchEvent(new Event('input'));
  };
  const submit = async () => {
    root().querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
  };
  const created = async (): Promise<TestRequest> => {
    await fill();
    await submit();
    return httpMock.expectOne(CREATE_URL);
  };
  const flushCreated = async (req: TestRequest, replayed = false) => {
    req.flush({ purchase: PURCHASE, replayed }, { status: replayed ? 200 : 201, statusText: 'OK' });
    await settle();
  };

  afterEach(() => httpMock.verify());

  it('mientras carga muestra «Entrada a bodega» y un esqueleto', async () => {
    await setup();
    fixture.detectChanges();
    expect(text()).toContain('Entrada a bodega');
    expect(root().querySelector('p-skeleton')).not.toBeNull();
    httpMock.expectOne(PRODUCTS_URL).flush(PRODUCTS);
    await settle();
  });

  it('con productos muestra el formulario', async () => {
    await setup();
    await load();
    expect(root().querySelector('app-purchase-form')).not.toBeNull();
  });

  it('sin productos activos muestra el estado vacío con «Cerrar»', async () => {
    await setup();
    await load([]);
    expect(text()).toContain('No hay productos activos');
    expect(root().querySelector('app-purchase-form')).toBeNull();
    button('Cerrar').click();
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });

  it('si la carga falla muestra el error y «Reintentar» vuelve a pedir los productos', async () => {
    await setup();
    fixture.detectChanges();
    httpMock.expectOne(PRODUCTS_URL).flush({}, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(text()).toContain('No pudimos cargar los productos');
    button('Reintentar').click();
    fixture.detectChanges(); // la recarga queda pendiente: no se espera a que termine
    httpMock.expectOne(PRODUCTS_URL).flush(PRODUCTS);
    await settle();
    expect(root().querySelector('app-purchase-form')).not.toBeNull();
  });

  it('guarda con { requestId, productId, qty }, muestra el resultado, avisa y notifica al stock', async () => {
    await setup();
    await load();
    const notify = vi.spyOn(stockChanges, 'notify');
    const req = await created();
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ productId: 10, qty: 5 });
    expect(typeof req.request.body.requestId).toBe('string');
    await flushCreated(req);
    expect(text()).toContain('3 → 8');
    expect(toast.success).toHaveBeenCalledWith('Entrada registrada');
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('sin conexión muestra «Reintentar» y reenvía con el mismo requestId', async () => {
    await setup();
    await load();
    const first = await created();
    const requestId = first.request.body.requestId;
    first.error(new ProgressEvent('error'), { status: 0 });
    await settle();
    expect(text()).toContain('No pudimos registrar la entrada');
    button('Reintentar').click();
    await settle();
    const second = httpMock.expectOne(CREATE_URL);
    expect(second.request.body.requestId).toBe(requestId);
    await flushCreated(second, true);
    expect(text()).toContain('3 → 8');
  });

  it('un conflicto 409 muestra el mensaje del backend sin salir del formulario', async () => {
    await setup();
    await load();
    const req = await created();
    req.flush({ error: { code: 'conflict', message: 'El producto está desactivado' } }, { status: 409, statusText: 'Conflict' });
    await settle();
    expect(text()).toContain('El producto está desactivado');
    expect(root().querySelector('app-purchase-form')).not.toBeNull();
  });

  it('«Registrar otra» vuelve al formulario con un requestId nuevo y recarga los productos', async () => {
    await setup();
    await load();
    const first = await created();
    const firstId = first.request.body.requestId;
    await flushCreated(first);
    button('Registrar otra').click();
    fixture.detectChanges(); // la recarga queda pendiente: no se espera a que termine
    httpMock.expectOne(PRODUCTS_URL).flush(PRODUCTS);
    await settle();
    const second = await created();
    expect(second.request.body.requestId).not.toBe(firstId);
    await flushCreated(second);
  });

  it('«Cancelar» cierra el pop-up', async () => {
    await setup();
    await load();
    button('Cancelar').click();
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });
});
