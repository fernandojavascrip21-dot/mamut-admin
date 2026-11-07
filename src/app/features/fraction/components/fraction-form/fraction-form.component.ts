import { CurrencyPipe } from '@angular/common';
import {
  Component, DestroyRef, ElementRef, OnInit, computed, inject, input, linkedSignal, output, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, Validators,
} from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import type { SelectPassThrough } from 'primeng/types/select';
import { PRICE_MAX, PRICE_SCALE, NO_UNITS_LABEL } from '../../constants/fraction-page.constants';
import type { FractionOption } from '../../interfaces/fraction.models';
import { fractionPreview } from '../../rules/fraction-preview.rules';
import { notBlank, portionsInRange, requiredMoney } from '../../validators/fraction-form.validators';
import {
  FRACTION_FORM_MESSAGES, FRACTION_FORM_TEXTS, FRACTION_SELECT_MOTION_OPTIONS,
} from './fraction-form.constants';
import type {
  FractionFieldWithError, FractionFormGroup, FractionFormSubmit, FractionProductOption,
  FractionServerErrors,
} from './fraction-form.models';

// Formulario de «Fraccionar» (HU-23). Es presentacional: las opciones llegan por `options` y el
// envío sale por `submitted` con { productId, portions, price }; el requestId y el POST son de la
// página. Los errores de cada campo aparecen al enviar, nunca al tocar.
@Component({
  imports: [CurrencyPipe, ReactiveFormsModule, InputText, ButtonDirective, Select],
  selector: 'app-fraction-form',
  templateUrl: './fraction-form.component.html',
})
export class FractionFormComponent implements OnInit {
  // --- Dependencias ---
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);

  // --- Entradas y salidas ---
  readonly options = input.required<FractionOption[]>();
  readonly initialProductId = input<number | null>(null); // ?producto= de la URL; se ignora si no está en la lista
  readonly saving = input(false); // deshabilita «Fraccionar» mientras el envío está en curso
  readonly serverErrors = input<FractionServerErrors>({});
  readonly notice = input<string | null>(null); // aviso general, justo encima del botón
  readonly submitted = output<FractionFormSubmit>();

  // --- Formulario y estados ---
  form!: FractionFormGroup;
  readonly texts = FRACTION_FORM_TEXTS;
  readonly motionOptions = FRACTION_SELECT_MOTION_OPTIONS;
  readonly selectedProductId = signal<number | null>(null);
  readonly portionsCount = signal<number | null>(null);
  private readonly fieldErrors = signal<Partial<Record<FractionFieldWithError, string>>>({});
  // Copia de los errores del servidor que se borra al cambiar ese campo; vuelve a llenarse cuando la
  // página manda errores nuevos (input nuevo).
  private readonly liveServerErrors = linkedSignal<FractionServerErrors>(() => this.serverErrors());

  readonly selectedOption = computed(() =>
    this.options().find((option) => option.productId === this.selectedProductId()) ?? null,
  );
  // Los enteros sin piezas se ven deshabilitados, con su etiqueta, en lugar de desaparecer.
  readonly productOptions = computed<FractionProductOption[]>(() =>
    this.options().map((option) => {
      const empty = option.warehouseUnits === 0;
      return {
        value: option.productId,
        label: empty ? `${option.name} · ${NO_UNITS_LABEL}` : option.name,
        disabled: empty,
      };
    }),
  );
  // Error del servidor gana al local; ambos se pintan en el mismo campo.
  readonly productError = computed(() => this.liveServerErrors().product ?? this.fieldErrors().product ?? null);
  readonly portionSizeError = computed(() => this.liveServerErrors().portionSize ?? this.fieldErrors().portionSize ?? null);
  // Con bolsita existente la porción es la suya: se muestra y no se edita.
  readonly portionSizeReadonly = computed(() => !!this.selectedOption()?.portionProduct);
  readonly portionsError = computed(() => this.liveServerErrors().portions ?? this.fieldErrors().portions ?? null);
  readonly priceError = computed(() => this.liveServerErrors().price ?? this.fieldErrors().price ?? null);
  // El entero sin piezas se marca como opción deshabilitada para lectores de pantalla (PrimeNG no lo pone).
  readonly productPassThrough = computed<SelectPassThrough>(() => ({
    label: {
      'aria-describedby': this.productError() ? 'product-error' : undefined,
      'aria-invalid': this.productError() ? 'true' : undefined,
    },
    option: (params) => ({ 'aria-disabled': disabledOptionAttribute(params) }),
  }));
  // Vista previa solo con entero elegido y bolsitas válidas; no muestra dinero.
  readonly preview = computed(() => {
    const option = this.selectedOption();
    const portions = this.portionsCount();
    return option && portions !== null ? fractionPreview(option.warehouseUnits, portions) : null;
  });

  private readonly productSelect = viewChild<Select>('productInput');
  private readonly portionSizeInput = viewChild<ElementRef<HTMLInputElement>>('portionSizeInput');
  private readonly portionsInput = viewChild<ElementRef<HTMLInputElement>>('portionsInput');
  private readonly priceInput = viewChild<ElementRef<HTMLInputElement>>('priceInput');

  // --- Getters ---
  get productControl() {
    return this.form.controls.productId;
  }

  get portionSizeControl() {
    return this.form.controls.portionSize;
  }

  get portionsControl() {
    return this.form.controls.portions;
  }

  get priceControl() {
    return this.form.controls.price;
  }

  // --- Ciclo de vida ---
  // Primero la estructura y sus validaciones; después el entero que llega por la URL.
  ngOnInit(): void {
    this.form = this.createEmptyForm();
    this.listenToFieldChanges();
    this.loadInitialValue();
  }

  private createEmptyForm(): FractionFormGroup {
    return this.formBuilder.group({
      productId: new FormControl<number | null>(null, Validators.required),
      portionSize: this.formBuilder.control('', notBlank()),
      portions: this.formBuilder.control('', portionsInRange()),
      price: this.formBuilder.control('', requiredMoney(PRICE_SCALE, PRICE_MAX)),
    });
  }

  // Escribir en un campo borra su error; elegir un entero prellena el precio y la porción de su bolsita.
  private listenToFieldChanges(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.syncPreview());
    this.productControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((productId) => {
      this.clearFieldError('product');
      this.prefillPrice(productId);
      this.prefillPortionSize(productId);
    });
    this.portionSizeControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearFieldError('portionSize'));
    this.portionsControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearFieldError('portions'));
    this.priceControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearFieldError('price'));
  }

  // La vista previa se calcula desde señales para que la plantilla no lea el formulario.
  private syncPreview(): void {
    this.selectedProductId.set(this.productControl.value);
    this.portionsCount.set(this.portionsControl.valid ? Number(this.portionsControl.value.trim()) : null);
  }

  // Bolsita existente: el precio arranca con el suyo (se puede cambiar). Sin bolsita empieza vacío.
  private prefillPrice(productId: number | null, options?: { emitEvent: boolean }): void {
    const option = this.options().find((item) => item.productId === productId);
    this.priceControl.setValue(option?.portionProduct?.price ?? '', options);
  }

  // La porción sale de la bolsita si existe (no se edita); sin bolsita, la del entero, que se puede cambiar.
  // Una bolsita sin porción guardada (cadena vacía) cae a la del entero, no deja el campo vacío.
  private prefillPortionSize(productId: number | null, options?: { emitEvent: boolean }): void {
    const option = this.options().find((item) => item.productId === productId);
    const bagSize = option?.portionProduct?.portionSize?.trim() ?? '';
    this.portionSizeControl.setValue(bagSize || option?.portionSize || '', options);
  }

  // Con ?producto= válido el entero queda elegido; uno que no está en la lista se ignora. La carga
  // inicial es silenciosa: no es una edición del usuario y no debe borrar los errores del servidor.
  private loadInitialValue(): void {
    const productId = this.initialProductId();
    if (productId === null || !this.options().some((option) => option.productId === productId)) return;
    const silent = { emitEvent: false };
    this.productControl.setValue(productId, silent);
    this.prefillPrice(productId, silent);
    this.prefillPortionSize(productId, silent);
    this.syncPreview();
  }

  // --- Controles que cambia el usuario ---
  // p-select usa un span como combobox: la etiqueta necesita esta acción para llevar el foco.
  focusProduct(): void {
    if (!this.saving()) this.productSelect()?.focus();
  }

  // --- Validación, payload y envío ---
  // Inválido: marca todo como tocado, pinta el error de cada campo, lleva el foco al primero y no
  // envía. Con el entero sin piezas no sale el POST: se avisa aquí, igual que el backend (409).
  onSubmit(): void {
    if (this.saving()) return; // sin segundo envío mientras el primero está en curso
    const errors = this.validationErrors();
    if (Object.keys(errors).length > 0) {
      this.form.markAllAsTouched();
      this.fieldErrors.set(errors);
      this.focusFirstError(errors);
      return;
    }
    this.fieldErrors.set({});
    this.submitted.emit(this.prepareSavePayload());
  }

  // Bolsitas y precio se validan como texto (money.ts, sin redondeo silencioso) y solo después se
  // convierten; el valor ya pasó la validación, por eso no hace falta un caso para el null.
  // La porción solo viaja con bolsita nueva: con una existente la base conserva la suya.
  private prepareSavePayload(): FractionFormSubmit {
    const raw = this.form.getRawValue();
    const payload: FractionFormSubmit = {
      productId: Number(raw.productId),
      portions: Number(raw.portions.trim()),
      price: raw.price.trim(),
    };
    return this.selectedOption()?.portionProduct ? payload : { ...payload, portionSize: raw.portionSize.trim() };
  }

  private validationErrors(): Partial<Record<FractionFieldWithError, string>> {
    const errors: Partial<Record<FractionFieldWithError, string>> = {};
    if (this.productControl.invalid) errors.product = FRACTION_FORM_MESSAGES.productRequired;
    else if (this.selectedOption()?.warehouseUnits === 0) errors.product = NO_UNITS_LABEL;
    // La porción sale del entero elegido: sin entero no hay de dónde tomarla y el error del producto basta.
    // Con bolsita existente la porción es solo informativa: su validez no bloquea el envío.
    if (!this.portionSizeReadonly() && this.productControl.valid && this.portionSizeControl.invalid) {
      errors.portionSize = this.firstErrorMessage(this.portionSizeControl, FRACTION_FORM_MESSAGES.portionSize);
    }
    if (this.portionsControl.invalid) {
      errors.portions = this.firstErrorMessage(this.portionsControl, FRACTION_FORM_MESSAGES.portions);
    }
    if (this.priceControl.invalid) {
      errors.price = this.firstErrorMessage(this.priceControl, FRACTION_FORM_MESSAGES.price);
    }
    return errors;
  }

  // Mensaje del primer validador que falló; si no hay uno propio, el genérico.
  private firstErrorMessage(control: AbstractControl, messages: Record<string, string>): string {
    const key = Object.keys(control.errors ?? {})[0];
    return (key && messages[key]) || FRACTION_FORM_MESSAGES.invalid;
  }

  private focusFirstError(errors: Partial<Record<FractionFieldWithError, string>>): void {
    if (errors.product) this.productSelect()?.focus();
    else if (errors.portionSize) this.portionSizeInput()?.nativeElement.focus();
    else if (errors.portions) this.portionsInput()?.nativeElement.focus();
    else this.priceInput()?.nativeElement.focus();
  }

  // Al cambiar un campo se borran su error local y el del servidor: el valor nuevo ya no es el rechazado.
  private clearFieldError(field: FractionFieldWithError): void {
    if (this.fieldErrors()[field]) this.fieldErrors.update((errors) => ({ ...errors, [field]: undefined }));
    if (this.liveServerErrors()[field]) this.liveServerErrors.update((errors) => ({ ...errors, [field]: null }));
  }
}

// PrimeNG pasa el contexto de cada opción en `context`, aunque su tipo no lo declare. Se comprueba en
// tiempo de ejecución para no usar casts.
function disabledOptionAttribute(params: unknown): 'true' | undefined {
  if (typeof params !== 'object' || params === null || !('context' in params)) return undefined;
  const context = params.context;
  return typeof context === 'object' && context !== null && 'disabled' in context && context.disabled === true
    ? 'true'
    : undefined;
}
