import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { EditProductPageComponent } from './edit-product-page.component';
import { API_BASE_URL } from '@core/api-base-url';
import { ProductSaveService } from '../../services/product-save.service';
import { ToastService } from '@core/toast/toast.service';
import type { Product, SaveResult } from '../../interfaces/product.models';

const CATEGORIES_URL = `${API_BASE_URL}/api/categories`;
const PRODUCT_URL = `${API_BASE_URL}/api/products/1`;
const CATEGORIES = [{ id: 7, name: 'Proteína', slug: 'proteina' }];
const PRODUCT: Product = {
  id: 1, name: 'Creatina', categoryId: 7, stock: 10, active: true, price: '200.00',
  unitCost: '100.00', fractionable: true, portionSize: '30 g', image: 'https://cdn.test/old.png',
};

// Cableado de la página con un doble de ProductSaveService: el cuerpo del PATCH, la subida de
// foto y Reintentar sin volver a subirla se prueban en product-save.service.spec.ts.
describe('EditProductPageComponent', () => {
  let fixture: ComponentFixture<EditProductPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let pending: Subject<SaveResult>;
  let saveService: { update: ReturnType<typeof vi.fn>; reset: ReturnType<typeof vi.fn> };
  let toast: ToastService;

  async function setup(id = '1') {
    saveService = {
      update: vi.fn(() => (pending = new Subject<SaveResult>())),
      reset: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [EditProductPageComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id }) } } },
      ],
    })
      .overrideComponent(EditProductPageComponent, {
        set: { providers: [{ provide: ProductSaveService, useValue: saveService }] },
      })
      .compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
    fixture = TestBed.createComponent(EditProductPageComponent);
    document.body.appendChild(fixture.nativeElement);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    toast.dismiss();
    httpMock.verify();
    fixture.nativeElement.remove();
  });

  function el<T extends Element>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  // rxResource aplica cada respuesta en una microtarea: hay que esperar antes de volver a pintar.
  // No usa whenStable() porque una prueba deja a propósito la petición de categorías pendiente.
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  async function load() {
    fixture.detectChanges();
    httpMock.expectOne(CATEGORIES_URL).flush(CATEGORIES);
    httpMock.expectOne(PRODUCT_URL).flush(PRODUCT);
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

  function respond(result: SaveResult) {
    pending.next(result);
    pending.complete();
    fixture.detectChanges();
  }

  describe('con un id válido', () => {
    beforeEach(() => setup());

    it('muestra carga y luego el formulario lleno, con piezas en solo lectura', async () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Cargando producto…');
      httpMock.expectOne(CATEGORIES_URL).flush(CATEGORIES);
      httpMock.expectOne(PRODUCT_URL).flush(PRODUCT);
      await settle();

      expect(fixture.nativeElement.textContent).toContain('Editar producto');
      expect(el<HTMLInputElement>('#name').value).toBe('Creatina');
      expect(el<HTMLSelectElement>('#category').value).toBe('7');
      expect(el('#units')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Las piezas solo cambian con movimientos');
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });

    it('conserva la categoría cuando el producto llega antes que el catálogo', async () => {
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(PRODUCT);
      await settle();
      httpMock.expectOne(CATEGORIES_URL).flush(CATEGORIES);
      await settle();
      expect(el<HTMLSelectElement>('#category').value).toBe('7');
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });

    it('un fallo de red permite reintentar la carga; un 404 muestra no disponible', async () => {
      fixture.detectChanges();
      httpMock.expectOne(CATEGORIES_URL).flush([]);
      httpMock.expectOne(PRODUCT_URL).error(new ProgressEvent('error'));
      await settle();
      expect(fixture.nativeElement.textContent).toContain('No pudimos cargar el producto');
      el<HTMLButtonElement>('.retry').click();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Cargando producto…');
      httpMock.expectOne(PRODUCT_URL).flush({}, { status: 404, statusText: 'Not Found' });
      await settle();
      expect(fixture.nativeElement.textContent).toContain('Este producto ya no está disponible');
    });

    it('guardar sin cambios vuelve a Productos sin llamar al servicio ni avisar', async () => {
      await load();
      submit();
      expect(saveService.update).not.toHaveBeenCalled();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/productos');
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('solo avisa al recargar cuando hay cambios sin guardar', async () => {
      await load();
      const clean = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
      fixture.componentInstance.onBeforeUnload(clean);
      expect(clean.defaultPrevented).toBe(false);
      change('#name', 'Creatina nueva');
      const dirty = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
      fixture.componentInstance.onBeforeUnload(dirty);
      expect(dirty.defaultPrevented).toBe(true);
    });

    it('tocar un campo y dejarlo igual no cuenta como cambio', async () => {
      await load();
      change('#price', '200');
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });

    it('con cambios guarda con el original y el valor, y al terminar navega sin preguntar', async () => {
      await load();
      change('#price', '250');
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
      submit();
      expect(saveService.update).toHaveBeenCalledWith(PRODUCT, expect.objectContaining({ price: '250', units: null }));
      expect(fixture.nativeElement.textContent).toContain('Guardando…');
      respond({ ok: true, product: { ...PRODUCT, price: '250.00' } });
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/productos');
      expect(toast.success).toHaveBeenCalledWith('Cambios guardados en «Creatina»');
    });

    it('un segundo envío mientras guarda no vuelve a llamar al servicio', async () => {
      await load();
      change('#price', '250');
      submit();
      fixture.componentInstance.save(saveService.update.mock.calls[0][1]);
      expect(saveService.update).toHaveBeenCalledTimes(1);
      respond({ ok: true, product: PRODUCT });
    });

    it('nombre duplicado marca el campo y lo enfoca', async () => {
      await load();
      change('#name', 'Otra');
      submit();
      respond({ ok: false, reason: 'duplicate-name' });
      await fixture.whenStable();
      expect(fixture.nativeElement.textContent).toContain('Ya existe un producto con ese nombre');
      expect(document.activeElement).toBe(el('#name'));
    });

    it('si el producto desapareció al guardar, muestra no disponible', async () => {
      await load();
      change('#name', 'Otra');
      submit();
      respond({ ok: false, reason: 'not-found' });
      expect(fixture.nativeElement.textContent).toContain('Este producto ya no está disponible');
      expect(toast.error).toHaveBeenCalledWith('Este producto ya no está disponible.');
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });

    it('offline: Reintentar reenvía el mismo valor', async () => {
      await load();
      change('#name', 'Otra');
      submit();
      respond({ ok: false, reason: 'offline' });
      expect(fixture.nativeElement.textContent).toContain('No se pudo guardar');
      expect(toast.error).toHaveBeenCalledWith('No se pudo guardar. Revisa tu conexión.');
      el<HTMLButtonElement>('.retry').click();
      fixture.detectChanges();
      expect(saveService.update).toHaveBeenCalledTimes(2);
      expect(saveService.update.mock.calls[1][1]).toBe(saveService.update.mock.calls[0][1]);
      respond({ ok: true, product: PRODUCT });
    });

    it('el diálogo de descartar resuelve cancelar (conserva lo escrito) o descartar', async () => {
      await load();
      change('#name', 'Creatina nueva');

      const cancel = fixture.componentInstance.confirmDiscard();
      fixture.detectChanges();
      const dialog = el<HTMLElement>('[role="alertdialog"]');
      expect(dialog.textContent).toContain('¿Descartar los cambios?');
      const [keepEditing] = Array.from(dialog.querySelectorAll('button')) as HTMLButtonElement[];
      expect(keepEditing.textContent?.trim()).toBe('Seguir editando');
      keepEditing.click();
      fixture.detectChanges();
      expect(await cancel).toBe(false);
      expect(el('[role="alertdialog"]')).toBeNull();
      expect(el<HTMLInputElement>('#name').value).toBe('Creatina nueva');

      const discard = fixture.componentInstance.confirmDiscard();
      fixture.detectChanges();
      el<HTMLElement>('[role="alertdialog"]').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      expect(await discard).toBe(false);

      const confirm = fixture.componentInstance.confirmDiscard();
      fixture.detectChanges();
      (el<HTMLButtonElement>('[role="alertdialog"] button:last-child')).click();
      expect(await confirm).toBe(true);
    });
  });

  it('un id que no es entero positivo es «no disponible» sin pedirlo', async () => {
    await setup('abc');
    fixture.detectChanges();
    httpMock.expectOne(CATEGORIES_URL).flush([]);
    httpMock.expectNone(`${API_BASE_URL}/api/products/abc`);
    expect(fixture.nativeElement.textContent).toContain('Este producto ya no está disponible');
  });
});
