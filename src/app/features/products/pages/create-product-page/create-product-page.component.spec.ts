import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { CreateProductPageComponent } from './create-product-page.component';
import { API_BASE_URL } from '@core/api-base-url';
import { ProductSaveService } from '../../services/product-save.service';
import { ToastService } from '@core/toast/toast.service';
import type { Product, SaveResult } from '../../interfaces/product.models';

const CATEGORIES_URL = `${API_BASE_URL}/api/categories`;
const CREATED_PRODUCT: Product = {
  id: 1, name: 'Creatina', categoryId: null, stock: 10, active: true, price: '200.00',
  unitCost: '100.00', fractionable: false, portionSize: null, image: '',
};

// Cableado de la página con un doble de ProductSaveService: la subida de foto, el mapeo de
// errores HTTP y Reintentar sin volver a subir se prueban en product-save.service.spec.ts.
describe('CreateProductPageComponent', () => {
  let fixture: ComponentFixture<CreateProductPageComponent>;
  let httpMock: HttpTestingController;
  let pending: Subject<SaveResult>;
  let saveService: { create: ReturnType<typeof vi.fn>; reset: ReturnType<typeof vi.fn> };
  let toast: ToastService;

  beforeEach(async () => {
    saveService = {
      create: vi.fn(() => (pending = new Subject<SaveResult>())),
      reset: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [CreateProductPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    })
      .overrideComponent(CreateProductPageComponent, {
        set: { providers: [{ provide: ProductSaveService, useValue: saveService }] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CreateProductPageComponent);
    document.body.appendChild(fixture.nativeElement);
    httpMock = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
    fixture.detectChanges();
    httpMock.expectOne(CATEGORIES_URL).flush([{ id: 7, name: 'Proteína', slug: 'proteina' }]);
    await fixture.whenStable();
  });

  afterEach(() => {
    toast.dismiss();
    httpMock.verify();
    fixture.nativeElement.remove();
  });

  function el<T extends Element>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  function fillAndSubmit() {
    for (const [selector, value] of [['#name', 'Creatina'], ['#unit-cost', '100'], ['#price', '200'], ['#units', '10']]) {
      el<HTMLInputElement>(selector).value = value;
      el<HTMLInputElement>(selector).dispatchEvent(new Event('input'));
    }
    el<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  function respond(result: SaveResult) {
    pending.next(result);
    pending.complete();
    fixture.detectChanges();
  }

  it('muestra el formulario de alta con las categorías', () => {
    expect(fixture.nativeElement.textContent).toContain('Nuevo producto');
    expect(el('#units')).toBeTruthy();
    expect(el<HTMLSelectElement>('#category').options.length).toBe(2);
  });

  it('con campos vacíos no llama al servicio', () => {
    el<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(saveService.create).not.toHaveBeenCalled();
  });

  it('guarda, deshabilita mientras tanto y muestra «Producto registrado»', () => {
    fillAndSubmit();
    expect(saveService.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Creatina', units: 10 }));
    expect(fixture.nativeElement.textContent).toContain('Guardando…');
    expect(el<HTMLInputElement>('#name').disabled).toBe(true);

    respond({ ok: true, product: CREATED_PRODUCT });
    expect(fixture.nativeElement.textContent).toContain('Producto registrado');
    expect(fixture.nativeElement.textContent).toContain('Creatina');
    expect(toast.success).toHaveBeenCalledWith('Producto «Creatina» registrado');
  });

  it('un segundo envío mientras guarda no vuelve a llamar al servicio', () => {
    fillAndSubmit();
    fixture.componentInstance.save(saveService.create.mock.calls[0][0]);
    expect(saveService.create).toHaveBeenCalledTimes(1);
    respond({ ok: true, product: CREATED_PRODUCT });
  });

  it('«Dar de alta otro producto» vuelve a un formulario vacío y olvida la foto subida', () => {
    fillAndSubmit();
    respond({ ok: true, product: CREATED_PRODUCT });
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find((button) => button.textContent?.trim() === 'Dar de alta otro producto')!.click();
    fixture.detectChanges();
    expect(saveService.reset).toHaveBeenCalled();
    expect(el<HTMLInputElement>('#name').value).toBe('');
  });

  it('nombre duplicado muestra el aviso en el campo y no entra a «registrado»', async () => {
    fillAndSubmit();
    respond({ ok: false, reason: 'duplicate-name' });
    await fixture.whenStable();
    expect(toast.error).toHaveBeenCalledWith('Ya existe un producto con ese nombre.');
    expect(fixture.nativeElement.textContent).toContain('Ya existe un producto con ese nombre');
    expect(fixture.nativeElement.textContent).not.toContain('Producto registrado');
    expect(document.activeElement).toBe(el('#name'));
  });

  it('categoría inexistente avisa en el campo y regresa al formulario', async () => {
    fillAndSubmit();
    respond({ ok: false, reason: 'category-missing' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('La categoría ya no existe');
    expect(document.activeElement).toBe(el('#category'));
    expect(el<HTMLInputElement>('#name').disabled).toBe(false);
  });

  it('offline: avisa, deshabilita y Reintentar reenvía el mismo valor', () => {
    fillAndSubmit();
    const firstValue = saveService.create.mock.calls[0][0];
    respond({ ok: false, reason: 'offline' });
    expect(fixture.nativeElement.textContent).toContain('No se pudo guardar');
    expect(toast.error).toHaveBeenCalledWith('No se pudo guardar. Revisa tu conexión.');
    expect(el<HTMLInputElement>('#name').disabled).toBe(true);

    el<HTMLButtonElement>('.retry').click();
    fixture.detectChanges();
    expect(saveService.create).toHaveBeenCalledTimes(2);
    expect(saveService.create.mock.calls[1][0]).toBe(firstValue);
    respond({ ok: true, product: CREATED_PRODUCT });
    expect(fixture.nativeElement.textContent).toContain('Producto registrado');
  });
});
