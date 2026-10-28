import { HttpErrorResponse } from '@angular/common/http';
import {
  Component, DestroyRef, ElementRef, Injector,
  afterNextRender, afterRenderEffect, computed, inject, linkedSignal, signal, viewChild,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, of, switchMap, tap, throwError } from 'rxjs';
import { ProductoFotosService } from '../../productos/services/producto-fotos.service';
import { ProductosService } from '../../productos/services/productos.service';
import { initialsOf } from '../../shared/initials';
import type { ConCambiosSinGuardar } from '../../productos/guards/cambios-sin-guardar.guard';
import type { Categoria, EditarProductoInput, NuevoProductoInput, Producto } from '../../productos/interfaces/producto.models';

type Modo = 'alta' | 'edicion';
type NuevoProductoState =
  'cargando' | 'no-disponible' | 'error-carga' | 'form' | 'loading' | 'duplicado' | 'offline' | 'registrado';
type SaveState = Exclude<NuevoProductoState, 'cargando' | 'error-carga'>;
type FormInput = Omit<NuevoProductoInput, 'image'> | Omit<EditarProductoInput, 'image'>;

// Marca que la falla vino de subir la foto, no del guardado: cualquier error ahí es «sin
// conexión», aunque el backend responda 422 (p. ej. archivo que no es imagen).
const UPLOAD_FAILED = Symbol('upload-failed');

// La pantalla 03b comparte validaciones y subida de foto entre alta y edición. La ruta con
// :id carga el producto completo; las piezas se muestran, pero nunca entran en el PATCH.
@Component({
  imports: [RouterLink],
  selector: 'app-nuevo-producto-page',
  templateUrl: './nuevo-producto-page.component.html',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class NuevoProductoPageComponent implements ConCambiosSinGuardar {
  private readonly productos = inject(ProductosService);
  private readonly fotos = inject(ProductoFotosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  readonly modo = signal<Modo>(this.route.snapshot.paramMap.has('id') ? 'edicion' : 'alta');
  // Un :id que no es entero positivo no se pide al backend: es «no disponible» de inmediato.
  private readonly productId = this.parseProductId();

  private readonly categoriesResource = rxResource({ stream: () => this.productos.listCategorias() });
  // Solo en edición con un id válido; sin params el recurso queda inactivo (alta).
  private readonly productResource = rxResource({
    params: () => (this.modo() === 'edicion' && this.productId !== null ? this.productId : undefined),
    stream: ({ params: id }) => this.productos.obtener(id),
  });

  readonly categorias = computed<Categoria[]>(() =>
    this.categoriesResource.hasValue() ? this.categoriesResource.value() : [],
  );
  readonly original = computed<Producto | null>(() =>
    this.productResource.hasValue() ? this.productResource.value() : null,
  );

  // Estado del guardado; el de carga sale del recurso del producto (ver `state`).
  private readonly saveState = signal<SaveState>('form');
  readonly state = computed<NuevoProductoState>(() => {
    const save = this.saveState();
    if (this.modo() === 'alta' || save === 'no-disponible') return save;
    if (this.productId === null) return 'no-disponible';
    const status = this.productResource.status();
    if (status === 'error') {
      // HttpErrorResponse llega tal cual (Angular solo envuelve errores sin name/message).
      const error = this.productResource.error();
      return error instanceof HttpErrorResponse && error.status === 404 ? 'no-disponible' : 'error-carga';
    }
    if (status === 'loading' || status === 'reloading' || !this.productResource.hasValue()) return 'cargando';
    return save;
  });

  // Se reinician con cada producto cargado; el usuario los cambia al escribir.
  readonly fractionable = linkedSignal(() => this.original()?.fractionable ?? false);
  readonly precio = linkedSignal(() => this.original()?.price ?? '');
  readonly costo = linkedSignal(() => this.original()?.unitCost ?? '');
  readonly productoCreado = signal<Producto | null>(null);
  readonly fotoElegida = signal<File | null>(null);
  readonly fotoPreview = signal('');
  readonly quitarFoto = signal(false);
  readonly imagenRota = signal(false);
  readonly confirmingDiscard = signal(false);
  private readonly saved = signal(false);

  readonly nameError = signal<string | null>(null);
  readonly priceError = signal<string | null>(null);
  readonly unitCostError = signal<string | null>(null);
  readonly initialQtyError = signal<string | null>(null);
  readonly portionSizeError = signal<string | null>(null);
  readonly categoryError = signal<string | null>(null);

  readonly precioMenorAlCosto = computed(() =>
    Number(this.precio()) > 0 && Number(this.costo()) > 0 && Number(this.precio()) < Number(this.costo()),
  );
  readonly precioErrorVisible = computed(() =>
    this.priceError() || (this.precioMenorAlCosto() ? 'El precio no puede ser menor que el costo' : null),
  );
  readonly formDisabled = computed(() => this.state() === 'loading' || this.state() === 'offline');
  readonly imagenVisible = computed(() => this.quitarFoto() ? '' : this.fotoPreview() || this.original()?.image || '');
  readonly inicial = computed(() => initialsOf(this.original()?.name || 'Producto'));

  private readonly nombreInput = viewChild<ElementRef<HTMLInputElement>>('nombre');
  private readonly categoriaInput = viewChild<ElementRef<HTMLSelectElement>>('categoria');
  private readonly costoInput = viewChild<ElementRef<HTMLInputElement>>('costo');
  private readonly precioInput = viewChild<ElementRef<HTMLInputElement>>('precio');
  private readonly piezasInput = viewChild<ElementRef<HTMLInputElement>>('piezas');
  private readonly porcionInput = viewChild<ElementRef<HTMLInputElement>>('porcion');
  private readonly fotoInput = viewChild<ElementRef<HTMLInputElement>>('foto');
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
  cargarProducto(): void {
    this.productResource.reload();
  }

  toggleFractionable(checked: boolean): void {
    this.fractionable.set(checked);
    if (!checked) this.portionSizeError.set(null);
  }

  onPrecioInput(value: string): void {
    this.precio.set(value);
    this.priceError.set(null);
  }

  onCostoInput(value: string): void {
    this.costo.set(value);
    this.unitCostError.set(null);
  }

  // La selección se conserva si el PATCH falla; si ya se subió, Reintentar reusa la URL.
  onFotoElegida(file: File | null): void {
    this.fotoElegida.set(file);
    this.uploadedImageUrl = null;
    this.quitarFoto.set(false);
    this.imagenRota.set(false);
    this.fotoPreview.set('');
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (this.fotoElegida() === file) this.fotoPreview.set(String(reader.result || ''));
      };
      reader.readAsDataURL(file);
    }
  }

  quitarFotoActual(): void {
    this.quitarFoto.set(true);
    this.uploadedImageUrl = null;
    this.fotoElegida.set(null);
    this.fotoPreview.set('');
    const fotoInput = this.fotoInput();
    if (fotoInput) fotoInput.nativeElement.value = '';
  }

  // Valida antes de llamar a la API; en edición omite por completo las piezas.
  onSubmit(): void {
    const name = this.nombreInput()?.nativeElement.value.trim() ?? '';
    const categoryIdRaw = this.categoriaInput()?.nativeElement.value ?? '';
    const priceRaw = this.precioInput()?.nativeElement.value ?? '';
    const unitCostRaw = this.costoInput()?.nativeElement.value ?? '';
    const initialQtyRaw = this.piezasInput()?.nativeElement.value ?? '';
    const portionSize = this.porcionInput()?.nativeElement.value.trim() ?? '';
    const price = Number(priceRaw);
    const unitCost = Number(unitCostRaw);
    const initialQty = Number(initialQtyRaw);
    this.precio.set(priceRaw);
    this.costo.set(unitCostRaw);

    this.nameError.set(name ? null : 'Escribe el nombre del producto');
    this.priceError.set(priceRaw.trim() && price > 0 ? null : 'El precio debe ser mayor a 0');
    this.unitCostError.set(unitCostRaw.trim() && unitCost > 0 ? null : 'El costo debe ser mayor a 0');
    this.initialQtyError.set(this.modo() === 'alta' && (
      !initialQtyRaw.trim() || !Number.isInteger(initialQty) || initialQty <= 0
    ) ? 'Las piezas deben ser un número entero mayor a 0' : null);
    this.portionSizeError.set(this.fractionable() && !portionSize ? 'Escribe la porción' : null);
    this.categoryError.set(null);

    if (this.nameError() || this.priceError() || this.unitCostError() ||
        this.initialQtyError() || this.portionSizeError() || this.precioMenorAlCosto()) {
      const first = this.nameError() ? this.nombreInput() : this.unitCostError() ? this.costoInput()
        : this.priceError() || this.precioMenorAlCosto() ? this.precioInput()
        : this.initialQtyError() ? this.piezasInput() : this.porcionInput();
      first?.nativeElement.focus();
      return;
    }

    const common = {
      name, categoryId: categoryIdRaw === '' ? null : Number(categoryIdRaw), price, unitCost,
      fractionable: this.fractionable(), portionSize: this.fractionable() ? portionSize : null,
    };
    if (this.modo() === 'edicion') {
      if (!this.tieneCambiosSinGuardar()) {
        void this.router.navigateByUrl('/admin/productos');
        return;
      }
      this.attempt(common, this.fotoElegida());
    } else {
      this.attempt({ ...common, initialQty }, this.fotoElegida());
    }
  }

  retry(): void {
    if (this.lastAttempt) this.attempt(this.lastAttempt, this.pendingFile);
  }

  nuevoProducto(): void {
    this.lastAttempt = null;
    this.pendingFile = null;
    this.uploadedImageUrl = null;
    this.fotoElegida.set(null);
    this.fotoPreview.set('');
    const fotoInput = this.fotoInput();
    if (fotoInput) fotoInput.nativeElement.value = '';
    this.productoCreado.set(null);
    this.saveState.set('form');
  }

  // Una sola cadena: si hay foto nueva sin subir, se sube primero y su URL alimenta el
  // guardado. takeUntilDestroyed evita tocar el estado si el usuario ya salió de la pantalla.
  private attempt(input: FormInput, file: File | null): void {
    this.lastAttempt = input;
    this.pendingFile = file;
    this.saveState.set('loading');

    const upload$: Observable<unknown> = file && !this.uploadedImageUrl
      ? this.fotos.subir(file).pipe(
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
        next: (producto) => this.onSaved(producto),
        error: (error: unknown) => this.handleSaveError(error),
      });
  }

  private save$(input: FormInput): Observable<Producto> {
    if (this.modo() === 'edicion') {
      const original = this.original()!;
      const { name, categoryId, price, unitCost, fractionable, portionSize } = input;
      const image = this.quitarFoto() ? '' : this.uploadedImageUrl || original.image;
      return this.productos.actualizar(original.id, {
        name, categoryId, price, unitCost, fractionable, portionSize, image,
      });
    }
    return this.productos.crear({
      ...(input as Omit<NuevoProductoInput, 'image'>),
      image: this.uploadedImageUrl,
    });
  }

  private onSaved(producto: Producto): void {
    if (this.modo() === 'edicion') {
      this.saved.set(true); // Evita el diálogo al salir después de guardar.
      void this.router.navigateByUrl('/admin/productos');
      return;
    }
    this.productoCreado.set(producto);
    this.saveState.set('registrado');
  }

  private handleSaveError(error: unknown): void {
    if (error === UPLOAD_FAILED) {
      this.saveState.set('offline');
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 404 && this.modo() === 'edicion') {
      this.saveState.set('no-disponible');
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 409) {
      this.nameError.set('Ya existe un producto con ese nombre');
      this.saveState.set('duplicado');
      this.focusAfterRender(this.nombreInput());
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 422) {
      this.categoryError.set('La categoría ya no existe. Actualiza la página e inténtalo otra vez.');
      this.saveState.set('form');
      this.focusAfterRender(this.categoriaInput());
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
  tieneCambiosSinGuardar(): boolean {
    const original = this.original();
    const nombreInput = this.nombreInput();
    if (this.modo() !== 'edicion' || !original || !nombreInput || this.saved()) return false;
    return nombreInput.nativeElement.value.trim() !== original.name.trim() ||
      Number(this.categoriaInput()?.nativeElement.value || 0) !== (original.categoryId ?? 0) ||
      Number(this.precioInput()?.nativeElement.value) !== Number(original.price) ||
      Number(this.costoInput()?.nativeElement.value) !== Number(original.unitCost) ||
      this.fractionable() !== original.fractionable ||
      (this.fractionable() ? this.porcionInput()?.nativeElement.value.trim() || null : null) !== original.portionSize ||
      this.fotoElegida() !== null || (this.quitarFoto() && original.image !== '');
  }

  // El guard espera esta promesa; el diálogo conserva lo escrito si se cancela la salida.
  confirmarDescartar(): Promise<boolean> {
    if (this.discardPromise) return this.discardPromise;
    this.returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.discardPromise = new Promise<boolean>((resolve) => this.discardResolver = resolve);
    this.confirmingDiscard.set(true);
    return this.discardPromise;
  }

  cerrarDialogo(descartar: boolean): void {
    this.confirmingDiscard.set(false);
    this.discardResolver?.(descartar);
    this.discardResolver = null;
    this.discardPromise = null;
    this.returnFocusTo?.focus();
  }

  onDialogKeydown(event: KeyboardEvent): void {
    const confirmButton = this.confirmDiscardButton()?.nativeElement;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cerrarDialogo(false);
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
    if (this.tieneCambiosSinGuardar()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
