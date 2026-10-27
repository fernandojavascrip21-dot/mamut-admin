import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  Injector,
  ViewChild,
  afterNextRender,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductoFotosService } from '../../productos/services/producto-fotos.service';
import { ProductosService } from '../../productos/services/productos.service';
import type {
  Categoria,
  NuevoProductoInput,
  Producto,
} from '../../productos/interfaces/producto.models';

type NuevoProductoState =
  'form' | 'loading' | 'aviso-precio' | 'duplicado' | 'offline' | 'registrado';

// Pantalla 03b Nuevo producto + «Producto registrado» (HU-04, SCRUM-21). Estados y reglas:
// ver specs/M1-hu04-dar-de-alta-producto/spec.md §2-§3. `lastAttempt`/`pendingFile`/
// `uploadedImageUrl` sobreviven a Reintentar y a "Guardar de todas formas" para no perder lo
// escrito, no volver a subir la foto ni a pedir la confirmación de precio otra vez (criterio 7).
@Component({
  imports: [RouterLink],
  selector: 'app-nuevo-producto-page',
  templateUrl: './nuevo-producto-page.component.html',
})
export class NuevoProductoPageComponent implements OnInit {
  private readonly productos = inject(ProductosService);
  private readonly fotos = inject(ProductoFotosService);
  private readonly injector = inject(Injector);

  readonly state = signal<NuevoProductoState>('form');
  readonly categorias = signal<Categoria[]>([]);
  readonly fractionable = signal(false);
  readonly productoCreado = signal<Producto | null>(null);

  readonly nameError = signal<string | null>(null);
  readonly priceError = signal<string | null>(null);
  readonly unitCostError = signal<string | null>(null);
  readonly initialQtyError = signal<string | null>(null);
  readonly portionSizeError = signal<string | null>(null);
  readonly categoryError = signal<string | null>(null);

  @ViewChild('nombre') private nombreInput!: ElementRef<HTMLInputElement>;
  @ViewChild('categoria') private categoriaInput!: ElementRef<HTMLSelectElement>;
  @ViewChild('costo') private costoInput!: ElementRef<HTMLInputElement>;
  @ViewChild('precio') private precioInput!: ElementRef<HTMLInputElement>;
  @ViewChild('piezas') private piezasInput!: ElementRef<HTMLInputElement>;
  @ViewChild('porcion') private porcionInput!: ElementRef<HTMLInputElement>;

  // Deshabilita el formulario mientras se guarda, mientras espera confirmación del aviso de
  // precio, o mientras muestra el aviso sin conexión — en los tres casos, un Reintentar o una
  // confirmación reusan exactamente los valores ya validados, no lo que el formulario diga en
  // ese instante. En "duplicado" el formulario sigue editable: ahí es al nombre al que hay que
  // cambiarle algo.
  readonly formDisabled = computed(
    () =>
      this.state() === 'loading' || this.state() === 'aviso-precio' || this.state() === 'offline',
  );

  private lastAttempt: Omit<NuevoProductoInput, 'image'> | null = null;
  private pendingFile: File | null = null;
  private uploadedImageUrl: string | null = null;
  private priceWarningConfirmed = false;

  ngOnInit(): void {
    this.productos.listCategorias().subscribe((categorias) => this.categorias.set(categorias));
  }

  toggleFractionable(checked: boolean): void {
    this.fractionable.set(checked);
    if (!checked) this.portionSizeError.set(null);
  }

  // Valida en el cliente (criterios 3 y 4) antes de llamar al backend. Si el precio queda por
  // debajo del costo (criterio 6), pausa en "aviso-precio" en vez de guardar directo.
  onSubmit(
    name: string,
    categoryIdRaw: string,
    priceRaw: string,
    unitCostRaw: string,
    initialQtyRaw: string,
    portionSize: string,
    file: File | null,
  ): void {
    const trimmedName = name.trim();
    const price = Number(priceRaw);
    const unitCost = Number(unitCostRaw);
    const initialQty = Number(initialQtyRaw);
    const trimmedPortion = portionSize.trim();
    const fractionable = this.fractionable();

    this.nameError.set(trimmedName === '' ? 'Escribe el nombre del producto' : null);
    this.priceError.set(
      priceRaw.trim() === '' || !(price > 0) ? 'El precio debe ser mayor a 0' : null,
    );
    this.unitCostError.set(
      unitCostRaw.trim() === '' || !(unitCost > 0) ? 'El costo debe ser mayor a 0' : null,
    );
    this.initialQtyError.set(
      initialQtyRaw.trim() === '' || !Number.isInteger(initialQty) || initialQty <= 0
        ? 'Las piezas deben ser un número entero mayor a 0'
        : null,
    );
    this.portionSizeError.set(fractionable && trimmedPortion === '' ? 'Escribe la porción' : null);
    this.categoryError.set(null);

    if (
      this.nameError() ||
      this.priceError() ||
      this.unitCostError() ||
      this.initialQtyError() ||
      this.portionSizeError()
    ) {
      const firstInvalid = this.nameError()
        ? this.nombreInput
        : this.unitCostError()
          ? this.costoInput
          : this.priceError()
            ? this.precioInput
            : this.initialQtyError()
              ? this.piezasInput
              : this.porcionInput;
      firstInvalid.nativeElement.focus();
      return;
    }

    const categoryId = categoryIdRaw === '' ? null : Number(categoryIdRaw);
    const input: Omit<NuevoProductoInput, 'image'> = {
      name: trimmedName,
      categoryId,
      price,
      unitCost,
      initialQty,
      fractionable,
      portionSize: fractionable ? trimmedPortion : null,
    };

    if (price < unitCost && !this.priceWarningConfirmed) {
      this.lastAttempt = input;
      this.pendingFile = file;
      this.state.set('aviso-precio');
      return;
    }

    this.attempt(input, file);
  }

  // Botón "Guardar de todas formas" del aviso de precio (criterio 6).
  confirmarPrecioMenorAlCosto(): void {
    this.priceWarningConfirmed = true;
    if (this.lastAttempt) this.attempt(this.lastAttempt, this.pendingFile);
  }

  // Botón "Corregir" del aviso de precio: vuelve al formulario sin guardar nada.
  corregir(): void {
    this.state.set('form');
  }

  // Botón "Reintentar" del estado sin conexión (criterio 7): repite el mismo intento, sin
  // volver a pedir el archivo de foto si ya se subió ni a mostrar el aviso de precio otra vez.
  retry(): void {
    if (this.lastAttempt) this.attempt(this.lastAttempt, this.pendingFile);
  }

  // Botón de la pantalla "Producto registrado" para dar de alta otro producto sin recargar.
  nuevoProducto(): void {
    this.lastAttempt = null;
    this.pendingFile = null;
    this.uploadedImageUrl = null;
    this.priceWarningConfirmed = false;
    this.productoCreado.set(null);
    this.state.set('form');
  }

  private attempt(input: Omit<NuevoProductoInput, 'image'>, file: File | null): void {
    this.lastAttempt = input;
    this.pendingFile = file;
    this.state.set('loading');

    if (file && !this.uploadedImageUrl) {
      this.fotos.subir(file).subscribe({
        next: (url) => {
          this.uploadedImageUrl = url;
          this.save(input, url);
        },
        error: () => this.state.set('offline'),
      });
      return;
    }

    this.save(input, this.uploadedImageUrl);
  }

  private save(input: Omit<NuevoProductoInput, 'image'>, image: string | null): void {
    this.productos.crear({ ...input, image }).subscribe({
      next: (producto) => {
        this.productoCreado.set(producto);
        this.state.set('registrado');
      },
      error: (error: unknown) => this.handleSaveError(error),
    });
  }

  private handleSaveError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 409) {
      this.nameError.set('Ya existe un producto con ese nombre');
      this.state.set('duplicado');
      this.focusAfterRender(this.nombreInput);
      return;
    }
    // La categoría se borró entre que se cargó el <select> y que se guardó: no es un error de
    // conexión, es un dato que ya no existe. Se avisa y se regresa al formulario editable.
    if (error instanceof HttpErrorResponse && error.status === 422) {
      this.categoryError.set(
        'La categoría ya no existe. Actualiza la página e inténtalo otra vez.',
      );
      this.state.set('form');
      this.focusAfterRender(this.categoriaInput);
      return;
    }
    this.state.set('offline');
  }

  // El formulario está deshabilitado durante la petición; espera al siguiente render para enfocarlo.
  private focusAfterRender(field: ElementRef<HTMLInputElement | HTMLSelectElement>): void {
    afterNextRender(() => field.nativeElement.focus(), { injector: this.injector });
  }
}
