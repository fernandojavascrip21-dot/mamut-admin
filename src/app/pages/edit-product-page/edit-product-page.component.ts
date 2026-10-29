import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductFormComponent } from '../../products/components/product-form/product-form.component';
import { hasProductChanges } from '../../products/rules/product.rules';
import { ProductSaveService } from '../../products/services/product-save.service';
import { ProductsService } from '../../products/services/products.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { isNotFound } from '../../shared/http-errors';
import type { HasUnsavedChanges } from '../../products/interfaces/unsaved-changes.models';
import type { Category, Product, ProductFormValue, SaveResult } from '../../products/interfaces/product.models';
import type { EditProductState, SaveState } from './edit-product-page.models';

// Pantalla 03b en edición (/admin/productos/:id/editar, HU-06): carga el producto completo y
// las categorías, usa product-form en modo edición y guarda con ProductSaveService. Guardar sin
// cambios regresa sin llamar al backend, y salir con cambios pregunta «¿Descartar los cambios?»
// (unsavedChangesGuard y beforeunload).
@Component({
  imports: [RouterLink, ProductFormComponent, ConfirmDialogComponent],
  providers: [ProductSaveService],
  selector: 'app-edit-product-page',
  templateUrl: './edit-product-page.component.html',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class EditProductPageComponent implements HasUnsavedChanges {
  private readonly productsService = inject(ProductsService);
  private readonly saveService = inject(ProductSaveService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // Un :id que no es entero positivo no se pide al backend: es «no disponible» de inmediato.
  private readonly productId = this.parseProductId();

  private readonly categoriesResource = rxResource({ stream: () => this.productsService.listCategories() });
  // Sin params (id inválido) el recurso queda inactivo.
  private readonly productResource = rxResource({
    params: () => this.productId ?? undefined,
    stream: ({ params: id }) => this.productsService.getById(id),
  });

  readonly categories = computed<Category[]>(() =>
    this.categoriesResource.hasValue() ? this.categoriesResource.value() : [],
  );
  readonly original = computed<Product | null>(() =>
    this.productResource.hasValue() ? this.productResource.value() : null,
  );

  // Estado del guardado; el de carga sale del recurso del producto.
  private readonly saveState = signal<SaveState>('form');
  readonly state = computed<EditProductState>(() => {
    const save = this.saveState();
    if (save === 'not-found' || this.productId === null) return 'not-found';
    const status = this.productResource.status();
    if (status === 'error') return isNotFound(this.productResource.error()) ? 'not-found' : 'load-error';
    if (status === 'loading' || status === 'reloading' || !this.productResource.hasValue()) return 'loading-product';
    return save;
  });

  readonly nameTaken = signal(false);
  readonly categoryMissing = signal(false);
  readonly confirmingDiscard = signal(false);
  private readonly formDirty = signal(false);
  private readonly saved = signal(false);
  private readonly productForm = viewChild(ProductFormComponent);

  private lastValue: ProductFormValue | null = null;
  private discardResolver: ((discard: boolean) => void) | null = null;
  private discardPromise: Promise<boolean> | null = null;

  // Botón «Reintentar» del error de carga: vuelve a pedir el producto.
  loadProduct(): void {
    this.productResource.reload();
  }

  onDirtyChange(dirty: boolean): void {
    this.formDirty.set(dirty);
  }

  // Guardar sin cambios regresa a Productos sin PATCH (HU-06 §2). Ignora un segundo envío
  // mientras el primero sigue en curso; takeUntilDestroyed evita tocar el estado si el usuario
  // ya salió de la pantalla.
  save(value: ProductFormValue): void {
    const original = this.original();
    if (!original || this.saveState() === 'saving') return;
    if (!hasProductChanges(original, value)) {
      void this.router.navigateByUrl('/admin/productos');
      return;
    }
    this.lastValue = value;
    this.nameTaken.set(false);
    this.categoryMissing.set(false);
    this.saveState.set('saving');
    this.saveService
      .update(original, value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.showResult(result));
  }

  // Botón «Reintentar» del aviso sin conexión: reenvía lo mismo; la foto ya subida no se sube otra vez.
  retry(): void {
    if (this.lastValue) this.save(this.lastValue);
  }

  // Compara lo que hay en el formulario contra lo cargado; solo si el usuario tocó algo.
  hasUnsavedChanges(): boolean {
    const original = this.original();
    const form = this.productForm();
    if (!original || !form || this.saved() || !this.formDirty()) return false;
    return hasProductChanges(original, form.prepareSavePayload());
  }

  // El guard espera esta promesa; el diálogo conserva lo escrito si se cancela la salida.
  confirmDiscard(): Promise<boolean> {
    if (this.discardPromise) return this.discardPromise;
    this.discardPromise = new Promise<boolean>((resolve) => (this.discardResolver = resolve));
    this.confirmingDiscard.set(true);
    return this.discardPromise;
  }

  closeDialog(discard: boolean): void {
    this.confirmingDiscard.set(false);
    this.discardResolver?.(discard);
    this.discardResolver = null;
    this.discardPromise = null;
  }

  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  private showResult(result: SaveResult): void {
    if (result.ok) {
      this.saved.set(true); // Evita el diálogo al salir después de guardar.
      void this.router.navigateByUrl('/admin/productos');
      return;
    }
    this.nameTaken.set(result.reason === 'duplicate-name');
    this.categoryMissing.set(result.reason === 'category-missing');
    this.saveState.set(result.reason === 'offline' || result.reason === 'not-found' ? result.reason : 'form');
  }

  private parseProductId(): number | null {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
}
