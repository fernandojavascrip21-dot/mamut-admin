import {
  Component, DestroyRef, OnInit, computed, inject, input, linkedSignal, output, signal, viewChild, ElementRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl, FormBuilder, ReactiveFormsModule, Validators,
} from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import type { SelectPassThrough } from 'primeng/types/select';
import { unitsLabel } from '@shared/utils/units-label';
import type { ShrinkageOption, ShrinkageOptions } from '../../interfaces/shrinkage.models';
import { wholeQuantity } from '../../validators/shrinkage-form.validators';
import {
  SHRINKAGE_FORM_MESSAGES, SHRINKAGE_FORM_TEXTS, SHRINKAGE_SELECT_MOTION_OPTIONS,
} from './shrinkage-form.constants';
import type {
  ShrinkageFieldWithError, ShrinkageFormGroup, ShrinkageFormSubmit, ShrinkageServerErrors,
} from './shrinkage-form.models';

// Formulario de «Registrar merma» (HU-25). Es presentacional: las opciones llegan por `options` y el
// envío sale por `submitted` con { productId, qty, reason }; el requestId, la confirmación y el POST son
// de la página. Los errores de cada campo aparecen al enviar, nunca al tocar.
@Component({
  imports: [ReactiveFormsModule, InputText, ButtonDirective, Select],
  selector: 'app-shrinkage-form',
  templateUrl: './shrinkage-form.component.html',
})
export class ShrinkageFormComponent implements OnInit {
  // --- Dependencias ---
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);

  // --- Entradas y salidas ---
  readonly options = input.required<ShrinkageOptions>();
  readonly saving = input(false); // deshabilita «Registrar merma» mientras el envío está en curso
  readonly serverErrors = input<ShrinkageServerErrors>({});
  readonly notice = input<string | null>(null); // aviso general, justo encima de los botones
  readonly submitted = output<ShrinkageFormSubmit>();
  readonly cancelled = output<void>();

  // --- Formulario y estados ---
  form!: ShrinkageFormGroup;
  readonly texts = SHRINKAGE_FORM_TEXTS;
  readonly motionOptions = SHRINKAGE_SELECT_MOTION_OPTIONS;
  readonly selectedProductId = signal<number | null>(null);
  private readonly fieldErrors = signal<Partial<Record<ShrinkageFieldWithError, string>>>({});
  // Copia de los errores del servidor que se borra al cambiar ese campo; vuelve a llenarse cuando la
  // página manda errores nuevos.
  private readonly liveServerErrors = linkedSignal<ShrinkageServerErrors>(() => this.serverErrors());

  readonly selectedOption = computed<ShrinkageOption | null>(() =>
    this.options().products.find((option) => option.productId === this.selectedProductId()) ?? null,
  );
  // «Tiene N piezas» bajo el producto: lo que el titular tiene de ese producto, no un tope aparte.
  readonly holdsText = computed(() => {
    const option = this.selectedOption();
    return option ? `${this.texts.holds} ${unitsLabel(option.units)}` : null;
  });
  // Error del servidor gana al local; ambos se pintan en el mismo campo.
  readonly qtyError = computed(() => this.liveServerErrors().qty ?? this.fieldErrors().qty ?? null);
  readonly productError = computed(() => this.fieldErrors().product ?? null);
  readonly reasonError = computed(() => this.fieldErrors().reason ?? null);
  // Los errores quedan ligados al control con aria-describedby / aria-invalid (PrimeNG no lo pone solo).
  readonly productPassThrough = computed(() => describedSelect(this.productError(), 'product-error'));
  readonly reasonPassThrough = computed(() => describedSelect(this.reasonError(), 'reason-error'));

  private readonly productSelect = viewChild<Select>('productInput');
  private readonly qtyInput = viewChild<ElementRef<HTMLInputElement>>('qtyInput');
  private readonly reasonSelect = viewChild<Select>('reasonInput');

  // --- Getters ---
  get productControl() {
    return this.form.controls.productId;
  }

  get qtyControl() {
    return this.form.controls.qty;
  }

  get reasonControl() {
    return this.form.controls.reason;
  }

  // --- Ciclo de vida ---
  ngOnInit(): void {
    this.form = this.createEmptyForm();
    this.listenToFieldChanges();
  }

  private createEmptyForm(): ShrinkageFormGroup {
    return this.formBuilder.group({
      productId: this.formBuilder.control<number | null>(null, Validators.required),
      qty: this.formBuilder.control('', wholeQuantity()),
      reason: this.formBuilder.control('', Validators.required),
    });
  }

  // Escribir o elegir en un campo borra su error; elegir un producto actualiza la cifra «Tiene N piezas».
  private listenToFieldChanges(): void {
    this.productControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((productId) => {
      this.selectedProductId.set(productId);
      this.clearFieldError('product');
    });
    this.qtyControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearFieldError('qty'));
    this.reasonControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearFieldError('reason'));
  }

  // --- Controles que cambia el usuario ---
  // p-select usa un span como combobox: la etiqueta necesita esta acción para llevar el foco.
  focusProduct(): void {
    if (!this.saving()) this.productSelect()?.focus();
  }

  focusReason(): void {
    if (!this.saving()) this.reasonSelect()?.focus();
  }

  // --- Validación, payload y envío ---
  // Inválido: marca todo como tocado, pinta el error de cada campo, lleva el foco al primero y no
  // emite. Con más piezas de las que tiene el titular no sale nada: se avisa aquí.
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

  // Las piezas se validan como texto y solo después se convierten; el valor ya pasó la validación.
  private prepareSavePayload(): ShrinkageFormSubmit {
    const raw = this.form.getRawValue();
    return {
      productId: Number(raw.productId),
      qty: Number(raw.qty.trim()),
      reason: raw.reason,
    };
  }

  private validationErrors(): Partial<Record<ShrinkageFieldWithError, string>> {
    const errors: Partial<Record<ShrinkageFieldWithError, string>> = {};
    if (this.productControl.invalid) errors.product = SHRINKAGE_FORM_MESSAGES.product;
    if (this.reasonControl.invalid) errors.reason = SHRINKAGE_FORM_MESSAGES.reason;
    const option = this.selectedOption();
    if (this.qtyControl.invalid) {
      errors.qty = this.firstErrorMessage(this.qtyControl, SHRINKAGE_FORM_MESSAGES.qty);
    } else if (option && Number(this.qtyControl.value.trim()) > option.units) {
      errors.qty = `${this.texts.onlyHolds} ${unitsLabel(option.units)}`;
    }
    return errors;
  }

  // Mensaje del primer validador que falló; si no hay uno propio, el genérico.
  private firstErrorMessage(control: AbstractControl, messages: Record<string, string>): string {
    const key = Object.keys(control.errors ?? {})[0];
    return (key && messages[key]) || SHRINKAGE_FORM_MESSAGES.invalid;
  }

  private focusFirstError(errors: Partial<Record<ShrinkageFieldWithError, string>>): void {
    if (errors.product) this.productSelect()?.focus();
    else if (errors.qty) this.qtyInput()?.nativeElement.focus();
    else this.reasonSelect()?.focus();
  }

  // Al cambiar un campo se borran su error local y el del servidor: el valor nuevo ya no es el rechazado.
  private clearFieldError(field: ShrinkageFieldWithError): void {
    if (this.fieldErrors()[field]) this.fieldErrors.update((errors) => ({ ...errors, [field]: undefined }));
    if (field === 'qty' && this.liveServerErrors().qty) {
      this.liveServerErrors.update((errors) => ({ ...errors, qty: null }));
    }
  }
}

// Solo fija los atributos aria (aria-describedby y aria-invalid) que enlazan el error con el selector;
// no cambia la apariencia, que la pone `[invalid]`.
function describedSelect(error: string | null, errorId: string): SelectPassThrough {
  return {
    label: {
      'aria-describedby': error ? errorId : undefined,
      'aria-invalid': error ? 'true' : undefined,
    },
  };
}
