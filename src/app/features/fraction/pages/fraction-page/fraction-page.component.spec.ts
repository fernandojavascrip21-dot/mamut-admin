import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { API_BASE_URL } from '@core/api-base-url';
import { ToastService } from '@core/toast/toast.service';
import type { Fraction, FractionOption } from '../../interfaces/fraction.models';
import { FractionPageComponent } from './fraction-page.component';

const OPTIONS_URL = `${API_BASE_URL}/api/fractions/options`;
const CREATE_URL = `${API_BASE_URL}/api/fractions`;

const WHOLE: FractionOption = {
  productId: 10,
  name: 'Creatina 300 g',
  image: null,
  warehouseUnits: 3,
  unitCost: '450.0000',
  portionSize: '30 g',
  portionProduct: null,
};
const EMPTY: FractionOption = { ...WHOLE, productId: 13, name: 'Glutamina', warehouseUnits: 0 };
const FRACTION: Fraction = {
  id: 1,
  requestId: 'r-1',
  portions: 7,
  wholeUnitCost: '450.0000',
  portionUnitCost: '64.2857',
  createdAt: '2026-11-07T10:00:00Z',
  product: { id: 10, name: 'Creatina 300 g', stock: 2 },
  portionProduct: { id: 11, name: 'Creatina 300 g · bolsita 30 g', created: true, price: '85.00', stock: 7 },
};

describe('FractionPageComponent', () => {
  let fixture: ComponentFixture<FractionPageComponent>;
  let httpMock: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const root = () => document.body;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const setup = async (query: Record<string, string> = {}) => {
    toast = { success: vi.fn(), error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [FractionPageComponent],
      providers: [
        MessageService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(query) } } },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FractionPageComponent);
  };
  const load = async (products: FractionOption[] = [WHOLE, EMPTY]) => {
    fixture.detectChanges();
    httpMock.expectOne(OPTIONS_URL).flush({ products });
    await settle();
  };
  const fillAndSubmit = () => {
    const portions = root().querySelector<HTMLInputElement>('#portions')!;
    portions.value = '7';
    portions.dispatchEvent(new Event('input'));
    const price = root().querySelector<HTMLInputElement>('#price')!;
    price.value = '85.00';
    price.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    root().querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };
  const fail = async (status: number, code: string, message: string): Promise<void> => {
    httpMock.expectOne(CREATE_URL).flush({ error: { code, message } }, { status, statusText: 'Error' });
    await settle();
  };
  const created = async (): Promise<TestRequest> => {
    fillAndSubmit();
    return httpMock.expectOne(CREATE_URL);
  };

  afterEach(() => httpMock.verify());

  it('mientras carga muestra «Cargando productos…» y dice «De la bodega»', async () => {
    await setup();
    fixture.detectChanges();
    expect(text()).toContain('Fraccionar');
    expect(text()).toContain('De la bodega');
    expect(text()).toContain('Cargando productos…');
    httpMock.expectOne(OPTIONS_URL).flush({ products: [WHOLE] });
    await settle();
  });

  it('si falla la carga muestra «No pudimos cargar los productos» y Reintentar vuelve a pedir', async () => {
    await setup();
    fixture.detectChanges();
    httpMock.expectOne(OPTIONS_URL).error(new ProgressEvent('error'));
    await settle();
    expect(text()).toContain('No pudimos cargar los productos');
    const retry = Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.includes('Reintentar'))!;
    retry.click();
    fixture.detectChanges();
    httpMock.expectOne(OPTIONS_URL).flush({ products: [WHOLE] });
    await settle();
  });

  it('sin enteros fraccionables muestra el estado vacío con «Ir a Productos»', async () => {
    await setup();
    await load([]);
    expect(text()).toContain('No hay productos que se fraccionen');
    const link = Array.from(root().querySelectorAll('a')).find((a) => a.textContent!.includes('Ir a Productos'))!;
    expect(link.getAttribute('href')).toBe('/admin/productos');
  });

  it('con ?producto= deja ese entero elegido al cargar', async () => {
    await setup({ producto: '10' });
    await load();
    expect(text()).toContain('Creatina 300 g');
    expect(text()).toContain('Se creará la bolsita');
  });

  it('con ?producto= que no está en la lista se ignora', async () => {
    await setup({ producto: '999' });
    await load();
    expect(text()).not.toContain('Se creará la bolsita');
  });

  it('con ?producto= de un entero sin piezas lo deja elegido y al enviar dice «Sin piezas en bodega»', async () => {
    await setup({ producto: '13' });
    await load();
    fillAndSubmit();
    expect(text()).toContain('Sin piezas en bodega');
  });

  it('envía { requestId, productId, portions, price } a POST /api/fractions', async () => {
    await setup({ producto: '10' });
    await load();
    const req = await created();
    expect(req.request.body).toMatchObject({ productId: 10, portions: 7, price: '85.00' });
    expect(req.request.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    req.flush({ fraction: FRACTION, replayed: false }, { status: 201, statusText: 'Created' });
    await settle();
  });

  it('sin doble envío: con el primero en curso un segundo envío no manda otra petición', async () => {
    await setup({ producto: '10' });
    await load();
    const req = await created();
    root().querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(root().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    expect(text()).toContain('Fraccionando…');
    httpMock.expectNone(CREATE_URL);
    req.flush({ fraction: FRACTION, replayed: false }, { status: 201, statusText: 'Created' });
    await settle();
  });

  it('sin conexión muestra el aviso y reintentar manda el mismo requestId', async () => {
    await setup({ producto: '10' });
    await load();
    const first = await created();
    const requestId = first.request.body.requestId;
    first.error(new ProgressEvent('error'));
    await settle();
    expect(root().querySelector('.alert-danger')!.textContent).toContain(
      'No pudimos registrar el fraccionado. Inténtalo de nuevo.',
    );
    root().querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    const second = httpMock.expectOne(CREATE_URL);
    expect(second.request.body.requestId).toBe(requestId);
    second.flush({ fraction: FRACTION, replayed: false }, { status: 201, statusText: 'Created' });
    await settle();
  });

  it('409 de piezas pinta «Sin piezas en bodega» en el producto y recarga las opciones', async () => {
    await setup({ producto: '10' });
    await load();
    fillAndSubmit();
    httpMock.expectOne(CREATE_URL).flush({ error: { code: 'CONFLICT', message: 'No hay piezas suficientes' } }, { status: 409, statusText: 'Error' });
    fixture.detectChanges(); // rxResource pide las opciones en su effect, no al recibir el error
    httpMock.expectOne(OPTIONS_URL).flush({ products: [WHOLE] });
    await settle();
    expect(root().querySelector('.field-error')!.textContent).toContain('Sin piezas en bodega');
  });

  it('422 PRICE_BELOW_COST pinta el mensaje del backend en el campo precio', async () => {
    await setup({ producto: '10' });
    await load();
    fillAndSubmit();
    await fail(422, 'validation', 'El precio no puede ser menor que el costo');
    expect(text()).toContain('El precio no puede ser menor que el costo');
    expect(root().querySelector('#price')!.getAttribute('aria-describedby')).toBe('price-error');
  });

  it('422 PORTION_COST_ZERO pinta el mensaje en el campo bolsitas', async () => {
    await setup({ producto: '10' });
    await load();
    fillAndSubmit();
    await fail(422, 'validation', 'El costo por bolsita es demasiado bajo');
    expect(text()).toContain('El costo por bolsita es demasiado bajo');
    expect(root().querySelector('#portions')!.getAttribute('aria-describedby')).toBe('portions-error');
  });

  it('409 de conflicto muestra el aviso alert-danger con el mensaje y recarga las opciones', async () => {
    await setup({ producto: '10' });
    await load();
    fillAndSubmit();
    httpMock.expectOne(CREATE_URL).flush({ error: { code: 'FRACTION_MISMATCH', message: 'Esa operación ya se usó con otros datos' } }, { status: 409, statusText: 'Error' });
    fixture.detectChanges(); // rxResource pide las opciones en su effect, no al recibir el error
    httpMock.expectOne(OPTIONS_URL).flush({ products: [WHOLE] });
    await settle();
    expect(root().querySelector('.alert-danger')!.textContent).toContain('Esa operación ya se usó con otros datos');
  });

  it('al fraccionar muestra el toast y el resultado con el costo por bolsita del backend', async () => {
    await setup({ producto: '10' });
    await load();
    const req = await created();
    req.flush({ fraction: FRACTION, replayed: false }, { status: 201, statusText: 'Created' });
    await settle();
    expect(toast.success).toHaveBeenCalledWith('Fraccionado registrado');
    expect(text()).toContain('Fraccionado listo');
    expect(text()).toContain('$64.29');
    expect(root().querySelector('form')).toBeNull();
  });

  it('«Fraccionar otro» vacía el formulario, renueva el requestId y recarga las opciones', async () => {
    await setup({ producto: '10' });
    await load();
    const first = await created();
    const firstId = first.request.body.requestId;
    first.flush({ fraction: FRACTION, replayed: false }, { status: 201, statusText: 'Created' });
    await settle();

    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.includes('Fraccionar otro'))!.click();
    fixture.detectChanges();
    httpMock.expectOne(OPTIONS_URL).flush({ products: [WHOLE] });
    await settle();
    expect(root().querySelector<HTMLInputElement>('#portions')!.value).toBe('');
    expect(root().querySelector<HTMLInputElement>('#price')!.value).toBe('');

    root().querySelector<HTMLElement>('p-select')!.click();
    await settle();
    root().querySelector<HTMLElement>('li.p-select-option')!.click();
    await settle();
    const second = await created();
    expect(second.request.body.requestId).not.toBe(firstId);
    second.flush({ fraction: FRACTION, replayed: false }, { status: 201, statusText: 'Created' });
    await settle();
  });
});
