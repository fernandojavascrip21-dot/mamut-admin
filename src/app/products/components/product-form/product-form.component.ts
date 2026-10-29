import {
  Component, DestroyRef, ElementRef, OnInit, afterRenderEffect, computed, effect, inject, input,
  output, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, PristineChangeEvent, ReactiveFormsModule } from '@angular/forms';
import { filter, map } from 'rxjs';
import { initialsOf } from '@shared/initials';
import { notBlank } from '@shared/validators';
import { MONEY_MAX } from '@shared/money';
import {
  maxDecimals, maxMoney, portionRequiredWhenFractionable, positiveInteger, positiveNumber, priceNotBelowCost,
} from '../../validators/product-form.validators';
import type { Category, Product, ProductFormValue } from '../../interfaces/product.models';
import type { FieldWithError, ProductFormGroup } from './product-form.models';

// Mensajes de cada campo al enviar (HU-04 §2, HU-06 §2).
const FIELD_MESSAGES: Record<FieldWithError, string> = {
  name: 'Escribe el nombre del producto',
  unitCost: 'El costo debe ser mayor a 0',
  price: 'El precio debe ser mayor a 0',
  units: 'Las piezas deben ser un número entero mayor a 0',
  portionSize: 'Escribe la porción',
};

// Decimales de más o monto fuera de la columna (spec T-08 §3): nunca se redondea en silencio.
const MONEY_MESSAGES = {
  unitCost: { maxDecimals: 'El costo admite hasta 4 decimales', maxMoney: 'El costo es demasiado grande' },
  price: { maxDecimals: 'El precio admite hasta 2 decimales', maxMoney: 'El precio es demasiado grande' },
};

// Formulario de producto (pantalla 03b) compartido por el alta y la edición. Es presentacional:
// los datos llegan por `initialValue` y el guardado sale por `submitted`; cargar del backend,
// guardar y los estados de espera son de la página. Los errores de cada campo aparecen al
// enviar; solo «precio menor que el costo» se muestra en vivo y deshabilita «Guardar».
@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-product-form',
  templateUrl: './product-form.component.html',
})
export class ProductFormComponent implements OnInit {
  // --- Dependencias ---
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);

  // --- Entradas y salidas ---
  readonly mode = input.required<'create' | 'edit'>();
  readonly categories = input<Category[]>([]);
  readonly initialValue = input<Product | null>(null); // edición: llena el formulario y muestra «N en bodega»
  readonly busy = input(false); // deshabilita mientras guarda u offline
  readonly saving = input(false); // cambia «Guardar» por «Guardando…»
  readonly nameTaken = input(false); // 409: «Ya existe un producto con ese nombre»
  readonly categoryMissing = input(false); // 422: aviso en categoría
  readonly submitted = output<ProductFormValue>();
  readonly dirtyChange = output<boolean>();

  // --- Formulario y estados ---
  form!: ProductFormGroup;
  readonly fractionable = signal(false);
  readonly priceBelowCost = signal(false);

  private readonly fieldErrors = signal<Partial<Record<FieldWithError, string>>>({});
  readonly nameError = computed(() =>
    this.fieldErrors().name ?? (this.nameTaken() ? 'Ya existe un producto con ese nombre' : null),
  );
  readonly categoryError = computed(() =>
    this.categoryMissing() ? 'La categoría ya no existe. Actualiza la página e inténtalo otra vez.' : null,
  );
  readonly unitCostError = computed(() => this.fieldErrors().unitCost ?? null);
  readonly priceError = computed(() =>
    this.fieldErrors().price ?? (this.priceBelowCost() ? 'El precio no puede ser menor que el costo' : null),
  );
  readonly unitsError = computed(() => this.fieldErrors().units ?? null);
  readonly portionSizeError = computed(() => this.fieldErrors().portionSize ?? null);

  // La foto no es un control del formulario: es un archivo que se sube aparte.
  readonly selectedPhoto = signal<File | null>(null);
  readonly photoPreview = signal('');
  readonly removePhoto = signal(false);
  readonly imageBroken = signal(false);
  readonly visibleImage = computed(() =>
    this.removePhoto() ? '' : this.photoPreview() || this.initialValue()?.image || '',
  );
  readonly initial = computed(() => initialsOf(this.initialValue()?.name || 'Producto'));

  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly categoryInput = viewChild<ElementRef<HTMLSelectElement>>('categoryInput');
  private readonly unitCostInput = viewChild<ElementRef<HTMLInputElement>>('unitCostInput');
  private readonly priceInput = viewChild<ElementRef<HTMLInputElement>>('priceInput');
  private readonly unitsInput = viewChild<ElementRef<HTMLInputElement>>('unitsInput');
  private readonly portionSizeInput = viewChild<ElementRef<HTMLInputElement>>('portionSizeInput');
  private readonly photoInput = viewChild<ElementRef<HTMLInputElement>>('photoInput');

  // --- Getters ---
  get nameControl() {
    return this.form.controls.name;
  }

  get unitCostControl() {
    return this.form.controls.unitCost;
  }

  get priceControl() {
    return this.form.controls.price;
  }

  get unitsControl() {
    return this.form.controls.units;
  }

  get fractionableControl() {
    return this.form.controls.fractionable;
  }

  // --- Ciclo de vida ---
  constructor() {
    // Mientras la página guarda (o está sin conexión) el formulario queda deshabilitado.
    effect(() => {
      if (this.busy()) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
    });

    // Tras un 409 o un 422 el foco va al campo señalado, una vez que el formulario se habilitó.
    afterRenderEffect(() => {
      if (this.busy()) return;
      if (this.nameTaken()) this.nameInput()?.nativeElement.focus();
      else if (this.categoryMissing()) this.categoryInput()?.nativeElement.focus();
    });
  }

  // Primero la estructura vacía con sus reglas; después los datos del producto (si los hay).
  ngOnInit(): void {
    this.form = this.createEmptyForm();
    this.listenToFieldChanges();
    this.loadInitialValue();
  }

  // Estructura inicial y validaciones. Las piezas solo se validan (y se muestran) en el alta.
  private createEmptyForm(): ProductFormGroup {
    return this.formBuilder.group(
      {
        name: this.formBuilder.control('', notBlank()),
        categoryId: this.formBuilder.control(''),
        unitCost: this.formBuilder.control('', [positiveNumber(), maxDecimals(4), maxMoney(MONEY_MAX[4], 4)]),
        price: this.formBuilder.control('', [positiveNumber(), maxDecimals(2), maxMoney(MONEY_MAX[2], 2)]),
        units: new FormControl<number | null>(null, this.mode() === 'create' ? positiveInteger() : null),
        fractionable: this.formBuilder.control(false),
        portionSize: this.formBuilder.control(''),
      },
      { validators: [portionRequiredWhenFractionable(), priceNotBelowCost()] },
    );
  }

  // Reacciones a lo que escribe el usuario: escribir en precio o costo borra su error de campo,
  // desmarcar «se fracciona» borra el de porción, y la página se entera de si hay cambios.
  private listenToFieldChanges(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.fractionable.set(this.fractionableControl.value);
      this.priceBelowCost.set(this.form.hasError('priceBelowCost'));
    });
    this.priceControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearFieldError('price'));
    this.unitCostControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearFieldError('unitCost'));
    this.fractionableControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((checked) => {
      if (!checked) this.clearFieldError('portionSize');
    });
    this.form.events
      .pipe(
        filter((event) => event instanceof PristineChangeEvent),
        map((event) => !event.pristine),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((dirty) => this.dirtyChange.emit(dirty));
  }

  // --- Carga de datos ---
  // Edición: pasa el producto del backend a la estructura del formulario. La página pinta este
  // componente solo cuando el producto ya cargó, así que basta con hacerlo una vez.
  private loadInitialValue(): void {
    const product = this.initialValue();
    if (!product) return;
    this.form.patchValue({
      name: product.name,
      categoryId: product.categoryId === null ? '' : String(product.categoryId),
      unitCost: product.unitCost,
      price: product.price,
      fractionable: product.fractionable,
      portionSize: product.portionSize ?? '',
    });
  }

  // --- Controles que cambia el usuario ---
  // La selección se conserva hasta guardar; el servicio decide si ya se subió.
  onPhotoSelected(file: File | null): void {
    this.selectedPhoto.set(file);
    this.removePhoto.set(false);
    this.imageBroken.set(false);
    this.photoPreview.set('');
    this.form.markAsDirty();
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
    this.selectedPhoto.set(null);
    this.photoPreview.set('');
    this.form.markAsDirty();
    const photoInput = this.photoInput();
    if (photoInput) photoInput.nativeElement.value = '';
  }

  // --- Validación, payload y envío ---
  // Si el formulario es inválido, marca todo como tocado, pinta el error de cada campo, lleva
  // el foco al primero y no envía. Si es válido, emite el payload.
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showFieldErrors();
      return;
    }
    this.fieldErrors.set({});
    this.submitted.emit(this.prepareSavePayload());
  }

  // Payload con los nombres que espera ProductSaveService (nombre, porción y dinero sin espacios;
  // el dinero sigue como texto, spec T-08). getRawValue incluye los controles aunque estén deshabilitados. La
  // página de edición también lo usa para comparar contra lo cargado antes de salir.
  prepareSavePayload(): ProductFormValue {
    const raw = this.form.getRawValue();
    return {
      name: raw.name.trim(),
      categoryId: raw.categoryId === '' ? null : Number(raw.categoryId),
      price: raw.price.trim(),
      unitCost: raw.unitCost.trim(),
      units: this.mode() === 'create' && raw.units !== null ? Number(raw.units) : null,
      fractionable: raw.fractionable,
      portionSize: raw.fractionable ? raw.portionSize.trim() : null,
      photo: this.selectedPhoto(),
      removePhoto: this.removePhoto(),
    };
  }

  private showFieldErrors(): void {
    const errors: Partial<Record<FieldWithError, string>> = {};
    if (this.nameControl.invalid) errors.name = FIELD_MESSAGES.name;
    if (this.unitCostControl.invalid) errors.unitCost = this.moneyError('unitCost');
    if (this.priceControl.invalid) errors.price = this.moneyError('price');
    if (this.unitsControl.invalid) errors.units = FIELD_MESSAGES.units;
    if (this.form.hasError('portionRequired')) errors.portionSize = FIELD_MESSAGES.portionSize;
    this.fieldErrors.set(errors);

    const first = errors.name ? this.nameInput()
      : errors.unitCost ? this.unitCostInput()
      : errors.price || this.priceBelowCost() ? this.priceInput()
      : errors.units ? this.unitsInput()
      : this.portionSizeInput();
    first?.nativeElement.focus();
  }

  // Mensaje del campo de dinero: primero el más específico (decimales, monto grande), después
  // «mayor a 0», que también cubre un texto que no es decimal.
  private moneyError(field: 'unitCost' | 'price'): string {
    const control = this.form.controls[field];
    if (control.hasError('maxDecimals')) return MONEY_MESSAGES[field].maxDecimals;
    if (control.hasError('maxMoney')) return MONEY_MESSAGES[field].maxMoney;
    return FIELD_MESSAGES[field];
  }

  private clearFieldError(field: FieldWithError): void {
    if (this.fieldErrors()[field]) this.fieldErrors.update((errors) => ({ ...errors, [field]: undefined }));
  }
}
