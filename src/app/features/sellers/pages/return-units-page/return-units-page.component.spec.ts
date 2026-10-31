import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import { ToastService } from '@core/toast/toast.service';
import { ViewingService } from '@core/viewing/viewing.service';
import type { SellerDetail, SellerReturn } from '../../interfaces/seller.models';
import { ReturnUnitsPageComponent } from './return-units-page.component';

const ID = 'v-1';
const SELLER_URL = `${API_BASE_URL}/api/sellers/${ID}`;
const RETURNS_URL = `${SELLER_URL}/returns`;

const SELLER: SellerDetail = {
  id: ID,
  fullName: 'Luis Prueba',
  email: 'luis@mammut.local',
  phone: '5524681357',
  active: true,
  units: 6,
  stock: [
    {
      productId: 10, name: 'Proteína Whey 2 lb', image: null, units: 6, warehouseUnits: 4,
      price: '450.00', unitCost: '300.0000', unitPrice: null, unitCostWithShipping: null,
    },
  ],
};

const SELLER_RETURN: SellerReturn = {
  requestId: 'r-1',
  createdAt: '2026-10-31T18:21:07.000Z',
  qty: 2,
  seller: { id: ID, fullName: 'Luis Prueba' },
  product: { id: 10, name: 'Proteína Whey 2 lb', image: null },
  sellerStock: { before: 6, after: 4 },
  warehouse: { before: 4, after: 6 },
};

describe('ReturnUnitsPageComponent', () => {
  let fixture: ComponentFixture<ReturnUnitsPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let picked: Subject<string | null>;
  let viewing: { picked: Subject<string | null>; select: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    picked = new Subject<string | null>();
    viewing = { picked, select: vi.fn() };
    toast = { success: vi.fn(), error: vi.fn() };
    const paramMap = new BehaviorSubject(convertToParamMap({ id: ID }));
    await TestBed.configureTestingModule({
      imports: [ReturnUnitsPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: ID }) }, paramMap: paramMap.asObservable() },
        },
        { provide: ViewingService, useValue: viewing },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ReturnUnitsPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // Una vuelta del reloj, sin esperar a las peticiones abiertas (whenStable no terminaría mientras
  // el stock se vuelve a pedir tras un 409).
  async function tick() {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  async function load(seller: SellerDetail = SELLER) {
    fixture.detectChanges();
    httpMock.expectOne(SELLER_URL).flush(seller);
    await settle();
  }

  // Elige el producto, escribe las piezas y envía el formulario.
  async function fillAndSubmit(qty: string, productId = 10) {
    const form = root().querySelector('app-return-form')!;
    const component = fixture.debugElement.query((d) => d.name === 'app-return-form').componentInstance;
    component.form.controls.productId.setValue(productId);
    const input = form.querySelector<HTMLInputElement>('#qty')!;
    input.value = qty;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    form.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('mientras carga muestra «Cargando…»', async () => {
    fixture.detectChanges();
    expect(text()).toContain('Cargando…');
    httpMock.expectOne(SELLER_URL).flush(SELLER);
    await settle();
  });

  it('con el vendedor cargado muestra el formulario con sus productos y elige al vendedor en la barra', async () => {
    await load();
    expect(root().querySelector('h1')!.textContent).toContain('Retirar producto');
    expect(root().querySelector('.seller-fixed')!.textContent).toContain('Luis Prueba');
    expect(root().querySelectorAll('#product option')).toHaveLength(2);
    expect(viewing.select).toHaveBeenCalledWith(ID);
  });

  it('un vendedor sin piezas muestra que no hay nada que retirar, con enlace a su detalle', async () => {
    await load({ ...SELLER, units: 0, stock: [] });
    expect(text()).toContain('Este vendedor no tiene piezas para retirar');
    expect(root().querySelector('app-return-form')).toBeNull();
    expect(root().querySelector('.empty a')!.getAttribute('href')).toBe('/admin/vendedores/v-1');
  });

  it('un 404 muestra «No encontramos a este vendedor» y no cambia la barra', async () => {
    fixture.detectChanges();
    httpMock.expectOne(SELLER_URL).flush({ error: { message: 'No encontrado' } }, { status: 404, statusText: 'x' });
    await settle();
    expect(text()).toContain('No encontramos a este vendedor');
    expect(viewing.select).not.toHaveBeenCalled();
  });

  it('un error de carga muestra «Reintentar» que vuelve a pedir al vendedor', async () => {
    fixture.detectChanges();
    httpMock.expectOne(SELLER_URL).flush({}, { status: 500, statusText: 'x' });
    await settle();
    expect(text()).toContain('No pudimos cargar al vendedor');

    root().querySelector<HTMLButtonElement>('.retry')!.click();
    fixture.detectChanges();
    httpMock.expectOne(SELLER_URL).flush(SELLER);
  });

  it('al registrar avisa con un toast y va al resumen reemplazando la entrada del historial', async () => {
    await load();
    await fillAndSubmit('2');

    const req = httpMock.expectOne(RETURNS_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ productId: 10, qty: 2 });
    req.flush(SELLER_RETURN, { status: 201, statusText: 'Created' });
    await settle();

    expect(toast.success).toHaveBeenCalledWith('Le retiraste 2 piezas a Luis Prueba');
    expect(router.navigate).toHaveBeenCalledWith(['/admin/vendedores', ID, 'retiros', 'r-1'], { replaceUrl: true });
  });

  it('no manda un segundo envío mientras el primero sigue en curso', async () => {
    await load();
    await fillAndSubmit('2');
    const component = fixture.componentInstance;
    component.save({ productId: 10, qty: 2 });
    httpMock.expectOne(RETURNS_URL).flush(SELLER_RETURN, { status: 201, statusText: 'Created' });
    await settle();
  });

  it('sin conexión muestra el aviso con «Reintentar», que reenvía el mismo requestId', async () => {
    await load();
    await fillAndSubmit('2');
    const first = httpMock.expectOne(RETURNS_URL);
    const requestId = first.request.body.requestId;
    first.error(new ProgressEvent('error'));
    await settle();

    expect(text()).toContain('No pudimos registrar el retiro');
    root().querySelector<HTMLButtonElement>('.offline .retry')!.click();
    fixture.detectChanges();
    const second = httpMock.expectOne(RETURNS_URL);
    expect(second.request.body.requestId).toBe(requestId);
    second.flush(SELLER_RETURN, { status: 200, statusText: 'OK' });
    await settle();
    expect(toast.success).toHaveBeenCalled();
  });

  it('un 409 por piezas muestra el error en el campo y vuelve a pedir el stock', async () => {
    await load();
    await fillAndSubmit('2');
    httpMock.expectOne(RETURNS_URL).flush(
      { error: { message: 'No hay piezas suficientes' } },
      { status: 409, statusText: 'x' },
    );
    await tick();

    expect(root().querySelector('#qty-error')!.textContent!.trim()).toBe('No hay piezas suficientes');
    expect(toast.error).toHaveBeenCalledWith('No hay piezas suficientes');
    // El formulario sigue en pantalla mientras se vuelve a pedir el stock.
    expect(root().querySelector('app-return-form')).not.toBeNull();
    httpMock.expectOne(SELLER_URL).flush({ ...SELLER, stock: [{ ...SELLER.stock[0]!, units: 1 }] });
    await settle();
  });

  it('un 409 de otros datos queda como aviso fijo y no ofrece reintentar', async () => {
    await load();
    await fillAndSubmit('2');
    httpMock.expectOne(RETURNS_URL).flush(
      { error: { message: 'Este retiro ya se registró con otros datos. Revisa el detalle del vendedor.' } },
      { status: 409, statusText: 'x' },
    );
    await settle();

    expect(root().querySelector('.failure')!.textContent).toContain('ya se registró con otros datos');
    expect(root().querySelector('.offline')).toBeNull();
  });

  it('elegir a otro vendedor en la barra abre su detalle', async () => {
    await load();
    picked.next('v-2');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/vendedores/v-2');
  });
});
