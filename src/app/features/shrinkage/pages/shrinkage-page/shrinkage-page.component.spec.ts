import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { API_BASE_URL } from '@core/api-base-url';
import { ConfirmService } from '@core/confirm/confirm.service';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ToastService } from '@core/toast/toast.service';
import { closeModalLink } from '@shared/utils/modal-links';
import type { Shrinkage, ShrinkageOptions } from '../../interfaces/shrinkage.models';
import { ShrinkagePageComponent } from './shrinkage-page.component';

const OPTIONS_URL = `${API_BASE_URL}/api/shrinkages/options`;
const CREATE_URL = `${API_BASE_URL}/api/shrinkages`;

const REASONS = [
  { code: 'lost', label: 'Se perdió' },
  { code: 'damaged', label: 'Dañado' },
  { code: 'expired', label: 'Caducó' },
  { code: 'other', label: 'Otro' },
];
const SELLER_OPTIONS: ShrinkageOptions = {
  holder: { id: 'v-1', fullName: 'Luis Prueba' },
  products: [{ productId: 10, name: 'Creatina 300 g', image: null, units: 6 }],
  reasons: REASONS,
};
const WAREHOUSE_OPTIONS: ShrinkageOptions = {
  holder: null,
  products: [{ productId: 10, name: 'Creatina 300 g', image: null, units: 9 }],
  reasons: REASONS,
};
const SHRINKAGE: Shrinkage = {
  requestId: 'r-1',
  createdAt: '2026-11-08T10:00:00Z',
  qty: 2,
  reason: 'damaged',
  reasonLabel: 'Dañado',
  holder: { id: 'v-1', fullName: 'Luis Prueba' },
  product: { id: 10, name: 'Creatina 300 g', image: null },
  stock: { before: 6, after: 4 },
};

describe('ShrinkagePageComponent', () => {
  let fixture: ComponentFixture<ShrinkagePageComponent>;
  let httpMock: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let confirm: { ask: ReturnType<typeof vi.fn> };
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
  const setup = async (query: Record<string, string> = {}) => {
    toast = { success: vi.fn(), error: vi.fn() };
    confirm = { ask: vi.fn().mockResolvedValue(true) };
    await TestBed.configureTestingModule({
      imports: [ShrinkagePageComponent],
      providers: [
        MessageService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(query) } } },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: confirm },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    stockChanges = TestBed.inject(StockChangesService);
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ShrinkagePageComponent);
  };
  const load = async (options: ShrinkageOptions = SELLER_OPTIONS) => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === OPTIONS_URL).flush(options);
    await settle();
  };
  // Abre el p-select número `index` (0 = producto, 1 = motivo) y elige la opción con ese texto.
  const choose = async (index: number, label: string) => {
    root().querySelectorAll<HTMLElement>('p-select')[index].click();
    await settle();
    Array.from(root().querySelectorAll<HTMLElement>('li.p-select-option'))
      .find((li) => li.textContent!.includes(label))!.click();
    await settle();
  };
  const fill = async (qty = '2') => {
    await choose(0, 'Creatina 300 g');
    const input = root().querySelector<HTMLInputElement>('#qty')!;
    input.value = qty;
    input.dispatchEvent(new Event('input'));
    await choose(1, 'Dañado');
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
    req.flush({ shrinkage: SHRINKAGE, replayed }, { status: replayed ? 200 : 201, statusText: 'OK' });
    await settle();
  };

  afterEach(() => httpMock.verify());

  it('mientras carga muestra «Registrar merma», «De la bodega» y un esqueleto', async () => {
    await setup();
    fixture.detectChanges();
    expect(text()).toContain('Registrar merma');
    expect(text()).toContain('De la bodega');
    expect(root().querySelector('p-skeleton')).not.toBeNull();
    httpMock.expectOne((r) => r.url === OPTIONS_URL).flush(WAREHOUSE_OPTIONS);
    await settle();
  });

  it('sin ?vendedor= pide las opciones de la bodega, sin sellerId', async () => {
    await setup();
    fixture.detectChanges();
    const req = httpMock.expectOne((r) => r.url === OPTIONS_URL);
    expect(req.request.params.has('sellerId')).toBe(false);
    req.flush(WAREHOUSE_OPTIONS);
    await settle();
  });

  it('con ?vendedor= pide sus opciones y dice «De <nombre>»', async () => {
    await setup({ vendedor: 'v-1' });
    fixture.detectChanges();
    const req = httpMock.expectOne((r) => r.url === OPTIONS_URL);
    expect(req.request.params.get('sellerId')).toBe('v-1');
    req.flush(SELLER_OPTIONS);
    await settle();
    expect(text()).toContain('De Luis Prueba');
  });

  it('si falla la carga muestra «No pudimos cargar los productos» y Reintentar vuelve a pedir', async () => {
    await setup();
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === OPTIONS_URL).error(new ProgressEvent('error'));
    await settle();
    expect(text()).toContain('No pudimos cargar los productos');
    button('Reintentar').click();
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === OPTIONS_URL).flush(WAREHOUSE_OPTIONS);
    await settle();
  });

  it('un vendedor que no existe (404) muestra «No encontramos a este vendedor» con «Cerrar»', async () => {
    await setup({ vendedor: 'x' });
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === OPTIONS_URL).flush(
      { error: { code: 'NOT_FOUND', message: 'No existe' } },
      { status: 404, statusText: 'Not Found' },
    );
    await settle();
    expect(text()).toContain('No encontramos a este vendedor');
    button('Cerrar').click();
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });

  it('sin piezas muestra «<Nombre> no tiene piezas» con «Cerrar»', async () => {
    await setup({ vendedor: 'v-1' });
    await load({ ...SELLER_OPTIONS, products: [] });
    expect(text()).toContain('Luis Prueba no tiene piezas');
    expect(button('Cerrar')).toBeDefined();
  });

  it('la bodega sin piezas muestra «La bodega no tiene piezas»', async () => {
    await setup();
    await load({ ...WAREHOUSE_OPTIONS, products: [] });
    expect(text()).toContain('La bodega no tiene piezas');
  });

  it('enviar vacío marca los errores y no pregunta ni manda nada', async () => {
    await setup();
    await load(WAREHOUSE_OPTIONS);
    await submit();
    expect(root().querySelectorAll('.field-error').length).toBeGreaterThan(0);
    expect(confirm.ask).not.toHaveBeenCalled();
    httpMock.expectNone(CREATE_URL);
  });

  it('con el formulario válido pregunta con el texto de la baja y botones «Dar de baja» / «Cancelar»', async () => {
    await setup({ vendedor: 'v-1' });
    await load();
    const req = await created();
    expect(confirm.ask).toHaveBeenCalledTimes(1);
    expect(confirm.ask).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('¿Dar de baja 2 piezas de Creatina 300 g de Luis Prueba por «Dañado»? No se puede deshacer.'),
        confirmLabel: 'Dar de baja',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      }),
    );
    await flushCreated(req);
  });

  it('si cancela la confirmación no manda nada y conserva lo escrito', async () => {
    await setup();
    await load(WAREHOUSE_OPTIONS);
    confirm.ask.mockResolvedValue(false);
    await fill();
    await submit();
    httpMock.expectNone(CREATE_URL);
    expect(root().querySelector<HTMLInputElement>('#qty')!.value).toBe('2');
  });

  it('al aceptar manda { requestId, holderProfileId, productId, qty, reason } a POST /api/shrinkages', async () => {
    await setup({ vendedor: 'v-1' });
    await load();
    const req = await created();
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ holderProfileId: 'v-1', productId: 10, qty: 2, reason: 'damaged' });
    expect(req.request.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    await flushCreated(req);
  });

  it('con la bodega manda holderProfileId null', async () => {
    await setup();
    await load(WAREHOUSE_OPTIONS);
    const req = await created();
    expect(req.request.body.holderProfileId).toBeNull();
    await flushCreated(req);
  });

  it('sin doble envío: con el primero en curso no hay otra petición y el botón está deshabilitado', async () => {
    await setup();
    await load(WAREHOUSE_OPTIONS);
    const req = await created();
    await submit();
    expect(root().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    expect(confirm.ask).toHaveBeenCalledTimes(1);
    httpMock.expectNone(CREATE_URL);
    await flushCreated(req);
  });

  it('sin conexión muestra el aviso con «Reintentar», que reenvía el mismo requestId', async () => {
    await setup();
    await load(WAREHOUSE_OPTIONS);
    const first = await created();
    const requestId = first.request.body.requestId;
    first.error(new ProgressEvent('error'));
    await settle();
    expect(root().querySelector('.alert-danger')!.textContent).toContain(
      'No pudimos registrar la merma. Inténtalo de nuevo.',
    );
    button('Reintentar').click();
    await settle();
    const second = httpMock.expectOne(CREATE_URL);
    expect(second.request.body.requestId).toBe(requestId);
    await flushCreated(second);
  });

  it('409 de piezas pinta el mensaje del backend en el campo piezas y recarga las opciones', async () => {
    await setup();
    await load(WAREHOUSE_OPTIONS);
    const req = await created();
    req.flush({ error: { code: 'CONFLICT', message: 'No hay piezas suficientes' } }, { status: 409, statusText: 'Error' });
    fixture.detectChanges(); // rxResource pide las opciones en su effect, no al recibir el error
    httpMock.expectOne((r) => r.url === OPTIONS_URL).flush(WAREHOUSE_OPTIONS);
    await settle();
    expect(root().querySelector('.field-error')!.textContent).toContain('No hay piezas suficientes');
    expect(root().querySelector<HTMLInputElement>('#qty')!.value).toBe('2');
  });

  it('409 SHRINKAGE_MISMATCH muestra el aviso alert-danger con el mensaje y conserva lo escrito', async () => {
    await setup();
    await load(WAREHOUSE_OPTIONS);
    const req = await created();
    req.flush(
      { error: { code: 'SHRINKAGE_MISMATCH', message: 'Esta merma ya se registró con otros datos.' } },
      { status: 409, statusText: 'Error' },
    );
    await settle();
    expect(root().querySelector('.alert-danger')!.textContent).toContain('Esta merma ya se registró con otros datos.');
    expect(root().querySelector<HTMLInputElement>('#qty')!.value).toBe('2');
  });

  it('404 al guardar muestra el aviso con el mensaje del backend y recarga las opciones', async () => {
    await setup();
    await load(WAREHOUSE_OPTIONS);
    const req = await created();
    req.flush({ error: { code: 'NOT_FOUND', message: 'El producto no existe' } }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === OPTIONS_URL).flush(WAREHOUSE_OPTIONS);
    await settle();
    expect(root().querySelector('.alert-danger')!.textContent).toContain('El producto no existe');
  });

  it('al registrar muestra el toast «Merma registrada», el resultado y avisa a StockChangesService', async () => {
    await setup({ vendedor: 'v-1' });
    await load();
    const notify = vi.spyOn(stockChanges, 'notify');
    const req = await created();
    await flushCreated(req);
    expect(toast.success).toHaveBeenCalledWith('Merma registrada');
    expect(notify).toHaveBeenCalledTimes(1);
    expect(text()).toContain('2 piezas · Dañado');
    expect(text()).toContain('6 → 4');
    expect(root().querySelector('form')).toBeNull();
  });

  it('una repetición (200, replayed) también muestra el resultado y el toast', async () => {
    await setup();
    await load(WAREHOUSE_OPTIONS);
    const req = await created();
    await flushCreated(req, true);
    expect(toast.success).toHaveBeenCalledWith('Merma registrada');
    expect(text()).toContain('6 → 4');
  });

  it('«Registrar otra» vacía el formulario, recarga las opciones y renueva el requestId', async () => {
    await setup();
    await load(WAREHOUSE_OPTIONS);
    const first = await created();
    const firstId = first.request.body.requestId;
    await flushCreated(first);

    button('Registrar otra').click();
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === OPTIONS_URL).flush(WAREHOUSE_OPTIONS);
    await settle();
    expect(root().querySelector<HTMLInputElement>('#qty')!.value).toBe('');

    const second = await created();
    expect(second.request.body.requestId).not.toBe(firstId);
    await flushCreated(second);
  });

  it('«Cerrar» en el resultado cierra el pop-up', async () => {
    await setup();
    await load(WAREHOUSE_OPTIONS);
    await flushCreated(await created());
    button('Cerrar').click();
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });
});
