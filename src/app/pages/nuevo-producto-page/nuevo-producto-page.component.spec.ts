import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
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
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
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
    el<HTMLInputElement>('#precio').value = values.precio;
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
    Object.defineProperty(el<HTMLInputElement>('#foto'), 'files', { value: [file], configurable: true });
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

  it('precio menor que el costo muestra el aviso; "Corregir" vuelve al formulario sin guardar', () => {
    fillForm({ precio: '50', costo: '100' });
    submit();

    expect(fixture.nativeElement.textContent).toContain('El precio es menor que el costo');
    httpMock.expectNone(PRODUCTS_URL);

    buttonWithText('Corregir').click();
    fixture.detectChanges();
    httpMock.expectNone(PRODUCTS_URL);
  });

  it('"Guardar de todas formas" reenvía los mismos datos que ya se habían validado', () => {
    fillForm({ precio: '50', costo: '100' });
    submit();

    buttonWithText('Guardar de todas formas').click();
    fixture.detectChanges();

    const req = httpMock.expectOne(PRODUCTS_URL);
    expect(req.request.body).toMatchObject({ name: 'Creatina', price: 50, unitCost: 100 });
    req.flush(PRODUCTO_CREADO, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Producto registrado');
  });

  it('nombre duplicado (409) muestra el aviso y no entra a "registrado"', () => {
    fillForm();
    submit();

    httpMock.expectOne(PRODUCTS_URL).flush(
      { error: { code: 'conflict', message: 'Ya existe un producto con ese nombre' } },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ya existe un producto con ese nombre');
  });

  it('categoryId inválido (422) avisa y regresa al formulario, no a un error roto', () => {
    fillForm();
    submit();

    httpMock.expectOne(PRODUCTS_URL).flush(
      { error: { code: 'validation', message: 'La categoría no existe' } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('La categoría ya no existe');
  });

  it('offline: Reintentar no vuelve a subir la foto ni a pedir la confirmación de precio', () => {
    fillForm({ precio: '50', costo: '100' });
    attachFile();
    submit();

    expect(fixture.nativeElement.textContent).toContain('El precio es menor que el costo');
    expect(fotosSubir).not.toHaveBeenCalled();

    buttonWithText('Guardar de todas formas').click();
    fixture.detectChanges();

    expect(fotosSubir).toHaveBeenCalledTimes(1);
    httpMock.expectOne(PRODUCTS_URL).error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No se pudo guardar');

    el<HTMLButtonElement>('.retry').click();
    fixture.detectChanges();

    expect(fotosSubir).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).not.toContain('El precio es menor que el costo');

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
