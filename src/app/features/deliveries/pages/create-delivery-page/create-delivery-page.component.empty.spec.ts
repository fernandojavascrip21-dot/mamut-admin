import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import type { ViewingListStatus } from '@core/viewing/interfaces/viewing.models';
import { ViewingService } from '@core/viewing/viewing.service';
import { closeModalLink } from '@shared/utils/modal-links';
import type { DeliveryProduct, DeliveryProductSummary } from '../../interfaces/delivery.models';
import { CreateDeliveryPageComponent } from './create-delivery-page.component';

const SELLER_ID = '3f2c8a1e-0000-4000-8000-000000000001';
const PRODUCTS_URL = `${API_BASE_URL}/api/products`;
const PRODUCT_URL = `${PRODUCTS_URL}/10`;

const WITH_UNITS: DeliveryProductSummary[] = [
  { id: 10, name: 'Proteína Whey', image: '', stock: 10, price: '450.00' },
];
const WITHOUT_UNITS: DeliveryProductSummary[] = [
  { id: 11, name: 'Agotado', image: '', stock: 0, price: '100.00' },
];
const EMPTY_PRODUCT: DeliveryProduct = {
  id: 10, name: 'Proteína Whey', image: '', stock: 0, price: '450.00', unitCost: '300.0000',
};

describe('CreateDeliveryPageComponent · estados vacíos', () => {
  let fixture: ComponentFixture<CreateDeliveryPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let sellers: ReturnType<typeof signal<{ id: string; fullName: string }[]>>;

  function setup(params: Record<string, string>, sellerList: { id: string; fullName: string }[]) {
    sellers = signal(sellerList);
    const viewing = {
      sellers,
      listStatus: signal<ViewingListStatus>('ready'),
      load: vi.fn(),
      reload: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [CreateDeliveryPageComponent],
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
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CreateDeliveryPageComponent);
  }

  const body = () => document.body;
  const text = () => body().textContent!.replace(/\s+/g, ' ');
  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }
  function button(label: string): HTMLButtonElement {
    const found = Array.from(body().querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!found) throw new Error(`No se encontró el botón «${label}»`);
    return found;
  }
  async function openList(sellerList: { id: string; fullName: string }[], products: DeliveryProductSummary[]) {
    setup({}, sellerList);
    fixture.detectChanges();
    httpMock.expectOne(PRODUCTS_URL).flush(products);
    await settle();
  }

  const ONE_SELLER = [{ id: SELLER_ID, fullName: 'Luis Pérez' }];

  afterEach(() => httpMock.verify());

  it('sin vendedores muestra «Aún no tienes vendedores» y no el formulario', async () => {
    await openList([], WITH_UNITS);
    expect(text()).toContain('Aún no tienes vendedores');
    expect(text()).toContain('Da de alta a un vendedor para dejarle producto.');
    expect(body().querySelector('app-delivery-form')).toBeNull();
    expect(body().querySelector('[role="status"]')).not.toBeNull();
  });

  it('«Dar de alta vendedor» navega a /admin/vendedores/nuevo cerrando el outlet en una sola llamada', async () => {
    await openList([], WITH_UNITS);
    button('Dar de alta vendedor').click();
    expect(router.navigate).toHaveBeenCalledTimes(1);
    const [commands] = vi.mocked(router.navigate).mock.calls[0];
    expect(JSON.stringify(commands)).toContain('/admin/vendedores/nuevo');
    expect(JSON.stringify(commands)).toContain('"ventana":null');
  });

  it('sin piezas en la bodega muestra «No hay piezas en la bodega»', async () => {
    await openList(ONE_SELLER, WITHOUT_UNITS);
    expect(text()).toContain('No hay piezas en la bodega');
    expect(text()).toContain('Da de alta un producto con sus piezas para poder dejárselo a un vendedor.');
    expect(body().querySelector('app-delivery-form')).toBeNull();
  });

  it('con la lista de productos vacía también muestra «No hay piezas en la bodega»', async () => {
    await openList(ONE_SELLER, []);
    expect(text()).toContain('No hay piezas en la bodega');
  });

  it('«Nuevo producto» navega a /admin/productos/nuevo cerrando el outlet en una sola llamada', async () => {
    await openList(ONE_SELLER, WITHOUT_UNITS);
    button('Nuevo producto').click();
    expect(router.navigate).toHaveBeenCalledTimes(1);
    const [commands] = vi.mocked(router.navigate).mock.calls[0];
    expect(JSON.stringify(commands)).toContain('/admin/productos/nuevo');
    expect(JSON.stringify(commands)).toContain('"ventana":null');
  });

  it('si faltan vendedores y piezas a la vez, gana «Aún no tienes vendedores»', async () => {
    await openList([], WITHOUT_UNITS);
    expect(text()).toContain('Aún no tienes vendedores');
    expect(text()).not.toContain('No hay piezas en la bodega');
  });

  it('con vendedor fijo y lista de «Viendo» vacía sigue en «No encontramos el producto o al vendedor»', () => {
    setup({ vendedor: SELLER_ID }, []);
    fixture.detectChanges();
    expect(text()).toContain('No encontramos el producto o al vendedor');
    expect(text()).not.toContain('Aún no tienes vendedores');
    httpMock.match(PRODUCTS_URL);
  });

  it('con producto fijo sin piezas no aparece «No hay piezas en la bodega» y se ve el formulario', async () => {
    setup({ producto: '10' }, ONE_SELLER);
    fixture.detectChanges();
    httpMock.expectOne(PRODUCT_URL).flush(EMPTY_PRODUCT);
    await settle();
    expect(text()).not.toContain('No hay piezas en la bodega');
    expect(body().querySelector('app-delivery-form')).not.toBeNull();
  });

  it('«Cerrar» en «Aún no tienes vendedores» cierra el pop-up', async () => {
    await openList([], WITH_UNITS);
    button('Cerrar').click();
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });

  it('«Cerrar» en «No hay piezas en la bodega» cierra el pop-up', async () => {
    await openList(ONE_SELLER, WITHOUT_UNITS);
    button('Cerrar').click();
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });
});
