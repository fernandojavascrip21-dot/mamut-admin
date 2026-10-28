import { HttpErrorResponse } from '@angular/common/http';
import {
  Component, DestroyRef, ElementRef, Injector,
  afterNextRender, afterRenderEffect, computed, inject, linkedSignal, signal, viewChild,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, of, switchMap, tap, throwError } from 'rxjs';
import { ProductPhotosService } from '../../products/services/product-photos.service';
import { ProductsService } from '../../products/services/products.service';
import { initialsOf } from '../../shared/initials';
import type { HasUnsavedChanges } from '../../products/guards/unsaved-changes.guard';
import type { Category, UpdateProductInput, CreateProductInput, Product } from '../../products/interfaces/product.models';

type Mode = 'create' | 'edit';
type ProductFormState =
  'loading-product' | 'not-found' | 'load-error' | 'form' | 'loading' | 'duplicate' | 'offline' | 'created';
type SaveState = Exclude<ProductFormState, 'loading-product' | 'load-error'>;
type FormInput = Omit<CreateProductInput, 'image'> | Omit<UpdateProductInput, 'image'>;

// Marca que la falla vino de subir la foto, no del guardado: cualquier error ahí es «sin
// conexión», aunque el backend responda 422 (p. ej. archivo que no es imagen).
const UPLOAD_FAILED = Symbol('upload-failed');

// La pantalla 03b comparte validaciones y subida de foto entre alta y edición. La ruta con
// :id carga el producto completo; las piezas se muestran, pero nunca entran en el PATCH.
@Component({
  imports: [RouterLink],
  selector: 'app-product-form-page',
  templateUrl: './product-form-page.component.html',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class ProductFormPageComponent implements HasUnsavedChanges {
  private readonly productsService = inject(ProductsService);
  private readonly photosService = inject(ProductPhotosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = signal<Mode>(this.route.snapshot.paramMap.has('id') ? 'edit' : 'create');
  // Un :id que no es entero positivo no se pide al backend: es «no disponible» de inmediato.
  private readonly productId = this.parseProductId();

  private readonly categoriesResource = rxResource({ stream: () => this.productsService.listCategories() });
  // Solo en edición con un id válido; sin params el recurso queda inactivo (alta).
  private readonly productResource = rxResource({
    params: () => (this.mode() === 'edit' && this.productId !== null ? this.productId : undefined),
    stream: ({ params: id }) => this.productsService.getById(id),
  });

  readonly categories = computed<Category[]>(() =>
    this.categoriesResource.hasValue() ? this.categoriesResource.value() : [],
  );
  readonly original = computed<Product | null>(() =>
    this.productResource.hasValue() ? this.productResource.value() : null,
  );

  // Estado del guardado; el de carga sale del recurso del producto (ver `state`).
  private readonly saveState = signal<SaveState>('form');
  readonly state = computed<ProductFormState>(() => {
    const save = this.saveState();
    if (this.mode() === 'create' || save === 'not-found') return save;
    if (this.productId === null) return 'not-found';
    const status = this.productResource.status();
    if (status === 'error') {
      // HttpErrorResponse llega tal cual (Angular solo envuelve errores sin name/message).
      const error = this.productResource.error();
      return error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'load-error';
    }
    if (status === 'loading' || status === 'reloading' || !this.productResource.hasValue()) return 'loading-product';
    return save;
  });

  // Se reinician con cada producto cargado; el usuario los cambia al escribir.
  readonly fractionable = linkedSignal(() => this.original()?.fractionable ?? false);
  readonly price = linkedSignal(() => this.original()?.price ?? '');
  readonly unitCost = linkedSignal(() => this.original()?.unitCost ?? '');
  readonly createdProduct = signal<Product | null>(null);
  readonly selectedPhoto = signal<File | null>(null);
  readonly photoPreview = signal('');
  readonly removePhoto = signal(false);
  readonly imageBroken = signal(false);
  readonly confirmingDiscard = signal(false);
  private readonly saved = signal(false);

  readonly nameError = signal<string | null>(null);
  readonly priceError = signal<string | null>(null);
  readonly unitCostError = signal<string | null>(null);
  readonly initialQtyError = signal<string | null>(null);
  readonly portionSizeError = signal<string | null>(null);
  readonly categoryError = signal<string | null>(null);

  readonly priceBelowCost = computed(() =>
    Number(this.price()) > 0 && Number(this.unitCost()) > 0 && Number(this.price()) < Number(this.unitCost()),
  );
  readonly showPriceError = computed(() =>
    this.priceError() || (this.priceBelowCost() ? 'El precio no puede ser menor que el costo' : null),
  );
  readonly formDisabled = computed(() => this.state() === 'loading' || this.state() === 'offline');
  readonly visibleImage = computed(() => this.removePhoto() ? '' : this.photoPreview() || this.original()?.image || '');
  readonly initial = computed(() => initialsOf(this.original()?.name || 'Producto'));

  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('name');
  private readonly categoryInput = viewChild<ElementRef<HTMLSelectElement>>('category');
  private readonly unitCostInput = viewChild<ElementRef<HTMLInputElement>>('unitCost');
  private readonly priceInput = viewChild<ElementRef<HTMLInputElement>>('price');
  private readonly unitsInput = viewChild<ElementRef<HTMLInputElement>>('units');
  private readonly portionSizeInput = viewChild<ElementRef<HTMLInputElement>>('portionSize');
  private readonly photoInput = viewChild<ElementRef<HTMLInputElement>>('photo');
  private readonly continueEditingButton = viewChild<ElementRef<HTMLButtonElement>>('continueEditingButton');
  private readonly confirmDiscardButton = viewChild<ElementRef<HTMLButtonElement>>('confirmDiscardButton');

  private lastAttempt: FormInput | null = null;
  private pendingFile: File | null = null;
  private uploadedImageUrl: string | null = null;
  private returnFocusTo: HTMLElement | null = null;
  private discardResolver: ((discard: boolean) => void) | null = null;
  private discardPromise: Promise<boolean> | null = null;

  // El botón aparece al renderizar el diálogo: el foco entra entonces en su primera acción.
  constructor() {
    afterRenderEffect(() => {
      const button = this.continueEditingButton();
      if (button && this.confirmingDiscard()) button.nativeElement.focus();
    });
  }

  // Botón «Reintentar» del error de carga: vuelve a pedir el producto.
  loadProduct(): void {
    this.productResource.reload();
  }

  toggleFractionable(checked: boolean): void {
    this.fractionable.set(checked);
    if (!checked) this.portionSizeError.set(null);
  }

  onPriceInput(value: string): void {
    this.price.set(value);
    this.priceError.set(null);
  }

  onUnitCostInput(value: string): void {
    this.unitCost.set(value);
    this.unitCostError.set(null);
  }

  // La selección se conserva si el PATCH falla; si ya se subió, Reintentar reusa la URL.
  onPhotoSelected(file: File | null): void {
    this.selectedPhoto.set(file);
    this.uploadedImageUrl = null;
    this.removePhoto.set(false);
    this.imageBroken.set(false);
    this.photoPreview.set('');
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (this.selectedPhoto() === file) this.photoPreview.set(String(reader.result || ''));
      };
      reader.readAsDataURL(file);
    }
  }

  removeCurrentPhoto(): void {
    this.removePhoto.set(true);
    this.uploadedImageUrl = null;
    this.selectedPhoto.set(null);
    this.photoPreview.set('');
    const photoInput = this.photoInput();
    if (photoInput) photoInput.nativeElement.value = '';
  }

  // Valida antes de llamar a la API; en edición omite por completo las piezas.
  onSubmit(): void {
    const name = this.nameInput()?.nativeElement.value.trim() ?? '';
    const categoryIdRaw = this.categoryInput()?.nativeElement.value ?? '';
    const priceRaw = this.priceInput()?.nativeElement.value ?? '';
    const unitCostRaw = this.unitCostInput()?.nativeElement.value ?? '';
    const initialQtyRaw = this.unitsInput()?.nativeElement.value ?? '';
    const portionSize = this.portionSizeInput()?.nativeElement.value.trim() ?? '';
    const price = Number(priceRaw);
    const unitCost = Number(unitCostRaw);
    const initialQty = Number(initialQtyRaw);
    this.price.set(priceRaw);
    this.unitCost.set(unitCostRaw);

    this.nameError.set(name ? null : 'Escribe el nombre del producto');
    this.priceError.set(priceRaw.trim() && price > 0 ? null : 'El precio debe ser mayor a 0');
    this.unitCostError.set(unitCostRaw.trim() && unitCost > 0 ? null : 'El costo debe ser mayor a 0');
    this.initialQtyError.set(this.mode() === 'create' && (
      !initialQtyRaw.trim() || !Number.isInteger(initialQty) || initialQty <= 0
    ) ? 'Las piezas deben ser un número entero mayor a 0' : null);
    this.portionSizeError.set(this.fractionable() && !portionSize ? 'Escribe la porción' : null);
    this.categoryError.set(null);

    if (this.nameError() || this.priceError() || this.unitCostError() ||
        this.initialQtyError() || this.portionSizeError() || this.priceBelowCost()) {
      const first = this.nameError() ? this.nameInput() : this.unitCostError() ? this.unitCostInput()
        : this.priceError() || this.priceBelowCost() ? this.priceInput()
        : this.initialQtyError() ? this.unitsInput() : this.portionSizeInput();
      first?.nativeElement.focus();
      return;
    }

    const common = {
      name, categoryId: categoryIdRaw === '' ? null : Number(categoryIdRaw), price, unitCost,
      fractionable: this.fractionable(), portionSize: this.fractionable() ? portionSize : null,
    };
    if (this.mode() === 'edit') {
      if (!this.hasUnsavedChanges()) {
        void this.router.navigateByUrl('/admin/productos');
        return;
      }
      this.attempt(common, this.selectedPhoto());
    } else {
      this.attempt({ ...common, initialQty }, this.selectedPhoto());
    }
  }

  retry(): void {
    if (this.lastAttempt) this.attempt(this.lastAttempt, this.pendingFile);
  }

  startNewProduct(): void {
    this.lastAttempt = null;
    this.pendingFile = null;
    this.uploadedImageUrl = null;
    this.selectedPhoto.set(null);
    this.photoPreview.set('');
    const photoInput = this.photoInput();
    if (photoInput) photoInput.nativeElement.value = '';
    this.createdProduct.set(null);
    this.saveState.set('form');
  }

  // Una sola cadena: si hay foto nueva sin subir, se sube primero y su URL alimenta el
  // guardado. takeUntilDestroyed evita tocar el estado si el usuario ya salió de la pantalla.
  private attempt(input: FormInput, file: File | null): void {
    this.lastAttempt = input;
    this.pendingFile = file;
    this.saveState.set('loading');

    const upload$: Observable<unknown> = file && !this.uploadedImageUrl
      ? this.photosService.upload(file).pipe(
          tap((url) => (this.uploadedImageUrl = url)),
          catchError(() => throwError(() => UPLOAD_FAILED)),
        )
      : of(null);

    upload$
      .pipe(
        switchMap(() => this.save$(input)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (product) => this.onSaved(product),
        error: (error: unknown) => this.handleSaveError(error),
      });
  }

  private save$(input: FormInput): Observable<Product> {
    if (this.mode() === 'edit') {
      const original = this.original()!;
      const { name, categoryId, price, unitCost, fractionable, portionSize } = input;
      const image = this.removePhoto() ? '' : this.uploadedImageUrl || original.image;
      return this.productsService.update(original.id, {
        name, categoryId, price, unitCost, fractionable, portionSize, image,
      });
    }
    return this.productsService.create({
      ...(input as Omit<CreateProductInput, 'image'>),
      image: this.uploadedImageUrl,
    });
  }

  private onSaved(product: Product): void {
    if (this.mode() === 'edit') {
      this.saved.set(true); // Evita el diálogo al salir después de guardar.
      void this.router.navigateByUrl('/admin/productos');
      return;
    }
    this.createdProduct.set(product);
    this.saveState.set('created');
  }

  private handleSaveError(error: unknown): void {
    if (error === UPLOAD_FAILED) {
      this.saveState.set('offline');
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 404 && this.mode() === 'edit') {
      this.saveState.set('not-found');
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 409) {
      this.nameError.set('Ya existe un producto con ese nombre');
      this.saveState.set('duplicate');
      this.focusAfterRender(this.nameInput());
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 422) {
      this.categoryError.set('La categoría ya no existe. Actualiza la página e inténtalo otra vez.');
      this.saveState.set('form');
      this.focusAfterRender(this.categoryInput());
      return;
    }
    this.saveState.set('offline');
  }

  private focusAfterRender(field?: ElementRef<HTMLInputElement | HTMLSelectElement>): void {
    if (field) afterNextRender(() => field.nativeElement.focus(), { injector: this.injector });
  }

  private parseProductId(): number | null {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  // Compara el formulario normalizado contra GET. Una foto nueva o quitada también cuenta.
  hasUnsavedChanges(): boolean {
    const original = this.original();
    const nameInput = this.nameInput();
    if (this.mode() !== 'edit' || !original || !nameInput || this.saved()) return false;
    return nameInput.nativeElement.value.trim() !== original.name.trim() ||
      Number(this.categoryInput()?.nativeElement.value || 0) !== (original.categoryId ?? 0) ||
      Number(this.priceInput()?.nativeElement.value) !== Number(original.price) ||
      Number(this.unitCostInput()?.nativeElement.value) !== Number(original.unitCost) ||
      this.fractionable() !== original.fractionable ||
      (this.fractionable() ? this.portionSizeInput()?.nativeElement.value.trim() || null : null) !== original.portionSize ||
      this.selectedPhoto() !== null || (this.removePhoto() && original.image !== '');
  }

  // El guard espera esta promesa; el diálogo conserva lo escrito si se cancela la salida.
  confirmDiscard(): Promise<boolean> {
    if (this.discardPromise) return this.discardPromise;
    this.returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.discardPromise = new Promise<boolean>((resolve) => this.discardResolver = resolve);
    this.confirmingDiscard.set(true);
    return this.discardPromise;
  }

  closeDialog(discard: boolean): void {
    this.confirmingDiscard.set(false);
    this.discardResolver?.(discard);
    this.discardResolver = null;
    this.discardPromise = null;
    this.returnFocusTo?.focus();
  }

  onDialogKeydown(event: KeyboardEvent): void {
    const confirmButton = this.confirmDiscardButton()?.nativeElement;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDialog(false);
    } else if (event.key === 'Tab' && confirmButton) {
      const first = (event.currentTarget as HTMLElement).querySelector<HTMLButtonElement>('button');
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        confirmButton.focus();
      } else if (!event.shiftKey && document.activeElement === confirmButton) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
