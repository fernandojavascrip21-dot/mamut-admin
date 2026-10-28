import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { NuevoProductoPageComponent } from './nuevo-producto-page.component';
import { API_BASE_URL } from '../../shared/api-base-url';
import { ProductoFotosService } from '../../productos/services/producto-fotos.service';
import type { Producto } from '../../productos/interfaces/producto.models';

const CATEGORIES_URL = `${API_BASE_URL}/api/categories`;
const PRODUCTS_URL = `${API_BASE_URL}/api/products`;

const PRODUCTO_CREADO: Producto = {
  id: 1,
  name: 'Creatina',
  categoryId: null,
  stock: 10,
  active: true,
  price: '200.00',
  unitCost: '100.00',
  fractionable: false,
  portionSize: null,
  image: '',
};

describe('NuevoProductoPageComponent', () => {
  let fixture: ComponentFixture<NuevoProductoPageComponent>;
  let httpMock: HttpTestingController;
  let fotosSubir: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fotosSubir = vi.fn().mockReturnValue(of('https://cdn.test/foto.png'));

    await TestBed.configureTestingModule({
      imports: [NuevoProductoPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ProductoFotosService, useValue: { subir: fotosSubir } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NuevoProductoPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(CATEGORIES_URL).flush([]);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function el<T extends Element>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  function buttonWithText(text: string): HTMLButtonElement {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const found = buttons.find((b) => b.textContent?.trim() === text);
    if (!found) throw new Error(`No se encontró el botón "${text}"`);
    return found;
  }

  function fillForm(
    overrides: Partial<{
      nombre: string;
      precio: string;
      costo: string;
      piezas: string;
      porcion: string;
      fractionable: boolean;
    }> = {},
  ) {
    const values = {
      nombre: 'Creatina',
      precio: '200',
      costo: '100',
      piezas: '10',
      porcion: '',
      fractionable: false,
      ...overrides,
    };
    el<HTMLInputElement>('#nombre').value = values.nombre;
    el<HTMLInputElement>('#costo').value = values.costo;
    el<HTMLInputElement>('#costo').dispatchEvent(new Event('input'));
    el<HTMLInputElement>('#precio').value = values.precio;
    el<HTMLInputElement>('#precio').dispatchEvent(new Event('input'));
    el<HTMLInputElement>('#piezas').value = values.piezas;
    const checkbox = el<HTMLInputElement>('input[type="checkbox"]');
    if (checkbox.checked !== values.fractionable) {
      checkbox.checked = values.fractionable;
      checkbox.dispatchEvent(new Event('change'));
    }
    fixture.detectChanges();
    el<HTMLInputElement>('#porcion').value = values.porcion;
  }

  function attachFile(): File {
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    Object.defineProperty(el<HTMLInputElement>('#foto'), 'files', {
      value: [file],
      configurable: true,
    });
    el<HTMLInputElement>('#foto').dispatchEvent(new Event('change'));
    return file;
  }

  function submit() {
    el<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  it('se crea', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('con campos vacíos marca el error de cada uno y no llama al backend', () => {
    fillForm({ nombre: '', precio: '', costo: '', piezas: '' });
    submit();

    const errors = fixture.nativeElement.querySelectorAll('.field-error');
    expect(errors.length).toBe(4);
    expect(el<HTMLInputElement>('#nombre').getAttribute('aria-describedby')).toBe('nombre-error');
    expect(document.activeElement).toBe(el<HTMLInputElement>('#nombre'));
    httpMock.expectNone(PRODUCTS_URL);
  });

  it('piezas con decimales marca error y no llama al backend', () => {
    fillForm({ piezas: '2.5' });
    submit();

    expect(fixture.nativeElement.textContent).toContain('número entero');
    httpMock.expectNone(PRODUCTS_URL);
  });

  it('sin marcar "se fracciona" el campo Porción queda oculto; marcándolo, aparece y es obligatorio', () => {
    expect(el<HTMLElement>('#porcion').parentElement?.classList.contains('hidden')).toBe(true);

    fillForm({ fractionable: true });
    expect(el<HTMLElement>('#porcion').parentElement?.classList.contains('hidden')).toBe(false);

    submit();
    expect(fixture.nativeElement.textContent).toContain('Escribe la porción');
    httpMock.expectNone(PRODUCTS_URL);
  });

  it('precio menor que el costo muestra el error en vivo y deshabilita Guardar', () => {
    fillForm({ precio: '50', costo: '100' });
    expect(fixture.nativeElement.textContent).toContain('El precio no puede ser menor que el costo');
    expect(buttonWithText('Guardar').disabled).toBe(true);
    expect(el<HTMLInputElement>('#precio').getAttribute('aria-describedby')).toBe('precio-error');
    httpMock.expectNone(PRODUCTS_URL);
  });

  it('precio igual al costo permite guardar', () => {
    fillForm({ precio: '100', costo: '100' });
    expect(buttonWithText('Guardar').disabled).toBe(false);
    submit();
    const req = httpMock.expectOne(PRODUCTS_URL);
    expect(req.request.body).toMatchObject({ name: 'Creatina', price: 100, unitCost: 100 });
    req.flush(PRODUCTO_CREADO, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Producto registrado');
  });

  it('nombre duplicado (409) muestra el aviso y no entra a "registrado"', () => {
    fillForm();
    submit();

    httpMock
      .expectOne(PRODUCTS_URL)
      .flush(
        { error: { code: 'conflict', message: 'Ya existe un producto con ese nombre' } },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ya existe un producto con ese nombre');
    expect(el<HTMLInputElement>('#nombre').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(el<HTMLInputElement>('#nombre'));
  });

  it('categoryId inválido (422) avisa y regresa al formulario, no a un error roto', () => {
    fillForm();
    submit();

    httpMock
      .expectOne(PRODUCTS_URL)
      .flush(
        { error: { code: 'validation', message: 'La categoría no existe' } },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('La categoría ya no existe');
    expect(el<HTMLSelectElement>('#categoria').getAttribute('aria-describedby')).toBe(
      'categoria-error',
    );
    expect(document.activeElement).toBe(el<HTMLSelectElement>('#categoria'));
  });

  it('offline: Reintentar no vuelve a subir la foto', () => {
    fillForm();
    attachFile();
    submit();

    expect(fotosSubir).toHaveBeenCalledTimes(1);
    httpMock.expectOne(PRODUCTS_URL).error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No se pudo guardar');

    el<HTMLButtonElement>('.retry').click();
    fixture.detectChanges();

    expect(fotosSubir).toHaveBeenCalledTimes(1);

    httpMock.expectOne(PRODUCTS_URL).flush(PRODUCTO_CREADO, { status: 201, statusText: 'Created' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Producto registrado');
  });

  it('si falla la subida de la foto (sin permiso), avisa sin llamar a crear el producto', () => {
    fotosSubir.mockReturnValue(throwError(() => new Error('forbidden')));
    fillForm();
    attachFile();
    submit();

    expect(fixture.nativeElement.textContent).toContain('No se pudo guardar');
    httpMock.expectNone(PRODUCTS_URL);
  });
});

describe('NuevoProductoPageComponent en edición', () => {
  let fixture: ComponentFixture<NuevoProductoPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let fotosSubir: ReturnType<typeof vi.fn>;
  const productUrl = `${PRODUCTS_URL}/1`;
  const PRODUCTO: Producto = {
    ...PRODUCTO_CREADO, categoryId: 7, fractionable: true, portionSize: '30 g',
    image: 'https://cdn.test/old.png',
  };

  beforeEach(async () => {
    fotosSubir = vi.fn().mockReturnValue(of('https://cdn.test/new.png'));
    await TestBed.configureTestingModule({
      imports: [NuevoProductoPageComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '1' }) } } },
        { provide: ProductoFotosService, useValue: { subir: fotosSubir } },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(NuevoProductoPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function el<T extends Element>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  // rxResource aplica cada respuesta en una microtarea: hay que esperar antes de volver a pintar.
  // No usa whenStable() porque una prueba deja a propósito la petición de categorías pendiente.
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  async function load(producto = PRODUCTO) {
    fixture.detectChanges();
    httpMock.expectOne(CATEGORIES_URL).flush([{ id: 7, name: 'Proteína', slug: 'proteina' }]);
    httpMock.expectOne(productUrl).flush(producto);
    await settle();
  }

  function change(selector: string, value: string) {
    const input = el<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function submit() {
    el<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  it('muestra carga, llena el formulario y deja piezas en solo lectura', async () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando producto…');
    httpMock.expectOne(CATEGORIES_URL).flush([{ id: 7, name: 'Proteína', slug: 'proteina' }]);
    httpMock.expectOne(productUrl).flush(PRODUCTO);
    await settle();

    expect(fixture.nativeElement.textContent).toContain('Editar producto');
    expect(el<HTMLInputElement>('#nombre').value).toBe('Creatina');
    expect(el<HTMLSelectElement>('#categoria').value).toBe('7');
    expect(el<HTMLInputElement>('#costo').value).toBe('100.00');
    expect(el<HTMLInputElement>('#precio').value).toBe('200.00');
    expect(el<HTMLInputElement>('#porcion').value).toBe('30 g');
    expect(el<HTMLInputElement>('input[type="checkbox"]').checked).toBe(true);
    expect(el<HTMLInputElement>('#piezas')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('10');
    expect(fixture.nativeElement.textContent).toContain('Las piezas solo cambian con movimientos');
    expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBe(false);
  });

  it('conserva la categoría cuando el producto llega antes que el catálogo', async () => {
    fixture.detectChanges();
    httpMock.expectOne(productUrl).flush(PRODUCTO);
    await settle();
    httpMock.expectOne(CATEGORIES_URL).flush([{ id: 7, name: 'Proteína', slug: 'proteina' }]);
    await settle();
    expect(el<HTMLSelectElement>('#categoria').value).toBe('7');
    expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBe(false);
  });

  it('404 muestra no disponible; un fallo de red permite reintentar GET', async () => {
    fixture.detectChanges();
    httpMock.expectOne(CATEGORIES_URL).flush([]);
    httpMock.expectOne(productUrl).error(new ProgressEvent('error'));
    await settle();
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar el producto');
    el<HTMLButtonElement>('.retry').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando producto…');
    httpMock.expectOne(productUrl).flush({}, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(fixture.nativeElement.textContent).toContain('Este producto ya no está disponible');
  });

  it('guardar sin cambios vuelve a Productos sin PATCH', async () => {
    await load();
    submit();
    httpMock.expectNone(productUrl);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/productos');
  });

  it('solo avisa al recargar cuando hay cambios sin guardar', async () => {
    await load();
    const clean = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    fixture.componentInstance.onBeforeUnload(clean);
    expect(clean.defaultPrevented).toBe(false);
    change('#nombre', 'Creatina nueva');
    const dirty = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    fixture.componentInstance.onBeforeUnload(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it('cambiar el precio manda el cuerpo completo sin piezas y navega', async () => {
    await load();
    change('#precio', '250');
    expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBe(true);
    submit();
    const patch = httpMock.expectOne(productUrl);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({
      name: 'Creatina', categoryId: 7, price: 250, unitCost: 100,
      fractionable: true, portionSize: '30 g', image: PRODUCTO.image,
    });
    patch.flush({ ...PRODUCTO, price: '250.00' });
    fixture.detectChanges();
    expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBe(false);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/productos');
  });

  it('409 marca nombre duplicado; campos vacíos no llaman al backend', async () => {
    await load();
    change('#nombre', 'Otra');
    submit();
    httpMock.expectOne(productUrl).flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ya existe un producto con ese nombre');
    change('#nombre', '');
    change('#precio', '');
    change('#costo', '');
    change('#porcion', '');
    submit();
    expect(fixture.nativeElement.querySelectorAll('.field-error').length).toBeGreaterThanOrEqual(4);
    httpMock.expectNone(productUrl);
  });

  it('quitar foto manda image vacío; offline reintenta PATCH sin subir otra vez', async () => {
    await load();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.trim() === 'Quitar foto')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBe(true);
    submit();
    const first = httpMock.expectOne(productUrl);
    expect(first.request.body.image).toBe('');
    first.error(new ProgressEvent('error'));
    fixture.detectChanges();
    el<HTMLButtonElement>('.retry').click();
    const second = httpMock.expectOne(productUrl);
    expect(second.request.body.image).toBe('');
    expect(fotosSubir).not.toHaveBeenCalled();
    second.flush({ ...PRODUCTO, image: '' });
  });

  it('cambiar foto la sube una vez incluso tras Reintentar, y el diálogo resuelve cancelar o descartar', async () => {
    await load();
    const file = new File(['x'], 'new.png', { type: 'image/png' });
    const photoInput = el<HTMLInputElement>('#foto');
    Object.defineProperty(photoInput, 'files', { value: [file], configurable: true });
    photoInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBe(true);

    const cancel = fixture.componentInstance.confirmarDescartar();
    fixture.detectChanges();
    expect(el<HTMLElement>('[role="alertdialog"]')).toBeTruthy();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('[role="alertdialog"] button')) as HTMLButtonElement[];
    buttons[0].click();
    expect(await cancel).toBe(false);
    expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBe(true);

    const discard = fixture.componentInstance.confirmarDescartar();
    fixture.detectChanges();
    (el<HTMLElement>('[role="alertdialog"] button:last-child') as HTMLButtonElement).click();
    expect(await discard).toBe(true);
    submit();
    expect(fotosSubir).toHaveBeenCalledTimes(1);
    const first = httpMock.expectOne(productUrl);
    expect(first.request.body.image).toBe('https://cdn.test/new.png');
    first.error(new ProgressEvent('error'));
    fixture.detectChanges();
    el<HTMLButtonElement>('.retry').click();
    const second = httpMock.expectOne(productUrl);
    expect(second.request.body.image).toBe('https://cdn.test/new.png');
    expect(fotosSubir).toHaveBeenCalledTimes(1);
    second.flush({ ...PRODUCTO, image: 'https://cdn.test/new.png' });
  });
});
