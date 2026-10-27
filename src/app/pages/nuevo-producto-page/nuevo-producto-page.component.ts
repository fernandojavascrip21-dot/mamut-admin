import { HttpErrorResponse } from '@angular/common/http';
import {
  Component, ElementRef, HostListener, Injector, OnInit, ViewChild,
  afterNextRender, computed, inject, signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductoFotosService } from '../../productos/services/producto-fotos.service';
import { ProductosService } from '../../productos/services/productos.service';
import { initialsOf } from '../../shared/initials';
import type { ConCambiosSinGuardar } from '../../productos/guards/cambios-sin-guardar.guard';
import type { Categoria, EditarProductoInput, NuevoProductoInput, Producto } from '../../productos/interfaces/producto.models';

type Modo = 'alta' | 'edicion';
type NuevoProductoState =
  'cargando' | 'no-disponible' | 'error-carga' | 'form' | 'loading' | 'duplicado' | 'offline' | 'registrado';
type FormInput = Omit<NuevoProductoInput, 'image'> | Omit<EditarProductoInput, 'image'>;

// La pantalla 03b comparte validaciones y subida de foto entre alta y edición. La ruta con
// :id carga el producto completo; las piezas se muestran, pero nunca entran en el PATCH.
@Component({
  imports: [RouterLink],
  selector: 'app-nuevo-producto-page',
  templateUrl: './nuevo-producto-page.component.html',
})
export class NuevoProductoPageComponent implements OnInit, ConCambiosSinGuardar {
  private readonly productos = inject(ProductosService);
  private readonly fotos = inject(ProductoFotosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  readonly modo = signal<Modo>(this.route.snapshot.paramMap.has('id') ? 'edicion' : 'alta');
  readonly state = signal<NuevoProductoState>(this.modo() === 'edicion' ? 'cargando' : 'form');
  readonly categorias = signal<Categoria[]>([]);
  readonly fractionable = signal(false);
  readonly original = signal<Producto | null>(null);
  readonly productoCreado = signal<Producto | null>(null);
  readonly precio = signal('');
  readonly costo = signal('');
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

  @ViewChild('nombre') private nombreInput?: ElementRef<HTMLInputElement>;
  @ViewChild('categoria') private categoriaInput?: ElementRef<HTMLSelectElement>;
  @ViewChild('costo') private costoInput?: ElementRef<HTMLInputElement>;
  @ViewChild('precio') private precioInput?: ElementRef<HTMLInputElement>;
  @ViewChild('piezas') private piezasInput?: ElementRef<HTMLInputElement>;
  @ViewChild('porcion') private porcionInput?: ElementRef<HTMLInputElement>;
  @ViewChild('foto') private fotoInput?: ElementRef<HTMLInputElement>;

  private lastAttempt: FormInput | null = null;
  private pendingFile: File | null = null;
  private uploadedImageUrl: string | null = null;
  private returnFocusTo: HTMLElement | null = null;
  private discardResolver: ((discard: boolean) => void) | null = null;
  private discardPromise: Promise<boolean> | null = null;
  private confirmButton: HTMLButtonElement | null = null;

  @ViewChild('continueEditingButton')
  set continueEditingButton(button: ElementRef<HTMLButtonElement> | undefined) {
    if (button && this.confirmingDiscard()) button.nativeElement.focus();
  }

  @ViewChild('confirmDiscardButton')
  set confirmDiscardButton(button: ElementRef<HTMLButtonElement> | undefined) {
    this.confirmButton = button?.nativeElement ?? null;
  }

  ngOnInit(): void {
    this.productos.listCategorias().subscribe((categorias) => this.categorias.set(categorias));
    if (this.modo() === 'edicion') this.cargarProducto();
  }

  // Un 404 significa que el producto ya no es editable; otros fallos permiten reintentar.
  cargarProducto(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isSafeInteger(id) || id <= 0) {
      this.state.set('no-disponible');
      return;
    }
    this.state.set('cargando');
    this.productos.obtener(id).subscribe({
      next: (producto) => {
        this.original.set(producto);
        this.fractionable.set(producto.fractionable);
        this.precio.set(producto.price);
        this.costo.set(producto.unitCost);
        this.state.set('form');
      },
      error: (error: unknown) => this.state.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'no-disponible' : 'error-carga',
      ),
    });
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
    if (this.fotoInput) this.fotoInput.nativeElement.value = '';
  }

  // Valida antes de llamar a la API; en edición omite por completo las piezas.
  onSubmit(): void {
    const name = this.nombreInput?.nativeElement.value.trim() ?? '';
    const categoryIdRaw = this.categoriaInput?.nativeElement.value ?? '';
    const priceRaw = this.precioInput?.nativeElement.value ?? '';
    const unitCostRaw = this.costoInput?.nativeElement.value ?? '';
    const initialQtyRaw = this.piezasInput?.nativeElement.value ?? '';
    const portionSize = this.porcionInput?.nativeElement.value.trim() ?? '';
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
      const first = this.nameError() ? this.nombreInput : this.unitCostError() ? this.costoInput
        : this.priceError() || this.precioMenorAlCosto() ? this.precioInput
        : this.initialQtyError() ? this.piezasInput : this.porcionInput;
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
    if (this.fotoInput) this.fotoInput.nativeElement.value = '';
    this.productoCreado.set(null);
    this.state.set('form');
  }

  private attempt(input: FormInput, file: File | null): void {
    this.lastAttempt = input;
    this.pendingFile = file;
    this.state.set('loading');
    if (file && !this.uploadedImageUrl) {
      this.fotos.subir(file).subscribe({
        next: (url) => {
          this.uploadedImageUrl = url;
          this.save(input);
        },
        error: () => this.state.set('offline'),
      });
      return;
    }
    this.save(input);
  }

  private save(input: FormInput): void {
    if (this.modo() === 'edicion') {
      this.guardarEdicion(input);
    } else {
      this.guardarAlta(input as Omit<NuevoProductoInput, 'image'>);
    }
  }

  private guardarEdicion(input: FormInput): void {
    const original = this.original()!;
    const { name, categoryId, price, unitCost, fractionable, portionSize } = input;
    const image = this.quitarFoto() ? '' : this.uploadedImageUrl || original.image;
    this.productos.actualizar(original.id, {
      name, categoryId, price, unitCost, fractionable, portionSize, image,
    }).subscribe({
      next: () => {
        this.saved.set(true); // Evita el diálogo al salir después de guardar.
        void this.router.navigateByUrl('/admin/productos');
      },
      error: (error: unknown) => this.handleSaveError(error),
    });
  }

  private guardarAlta(input: Omit<NuevoProductoInput, 'image'>): void {
    this.productos.crear({ ...input, image: this.uploadedImageUrl }).subscribe({
      next: (producto) => {
        this.productoCreado.set(producto);
        this.state.set('registrado');
      },
      error: (error: unknown) => this.handleSaveError(error),
    });
  }

  private handleSaveError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 404 && this.modo() === 'edicion') {
      this.state.set('no-disponible');
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 409) {
      this.nameError.set('Ya existe un producto con ese nombre');
      this.state.set('duplicado');
      this.focusAfterRender(this.nombreInput);
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 422) {
      this.categoryError.set('La categoría ya no existe. Actualiza la página e inténtalo otra vez.');
      this.state.set('form');
      this.focusAfterRender(this.categoriaInput);
      return;
    }
    this.state.set('offline');
  }

  private focusAfterRender(field?: ElementRef<HTMLInputElement | HTMLSelectElement>): void {
    if (field) afterNextRender(() => field.nativeElement.focus(), { injector: this.injector });
  }

  // Compara el formulario normalizado contra GET. Una foto nueva o quitada también cuenta.
  tieneCambiosSinGuardar(): boolean {
    const original = this.original();
    if (this.modo() !== 'edicion' || !original || !this.nombreInput || this.saved()) return false;
    return this.nombreInput.nativeElement.value.trim() !== original.name.trim() ||
      Number(this.categoriaInput?.nativeElement.value || 0) !== (original.categoryId ?? 0) ||
      Number(this.precioInput?.nativeElement.value) !== Number(original.price) ||
      Number(this.costoInput?.nativeElement.value) !== Number(original.unitCost) ||
      this.fractionable() !== original.fractionable ||
      (this.fractionable() ? this.porcionInput?.nativeElement.value.trim() || null : null) !== original.portionSize ||
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
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cerrarDialogo(false);
    } else if (event.key === 'Tab' && this.confirmButton) {
      const first = (event.currentTarget as HTMLElement).querySelector<HTMLButtonElement>('button');
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        this.confirmButton.focus();
      } else if (!event.shiftKey && document.activeElement === this.confirmButton) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.tieneCambiosSinGuardar()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
