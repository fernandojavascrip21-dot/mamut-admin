import {
  Component, DestroyRef, ElementRef, OnInit, computed, inject, input, linkedSignal, output, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import type { SelectPassThrough } from 'primeng/types/select';
import { unitsLabel } from '@shared/utils/units-label';
import type { PurchaseProduct } from '../../interfaces/purchase.models';
import { stockAfterPurchase } from '../../rules/purchase-stock.rules';
import { wholeQuantity } from '../../validators/purchase-form.validators';
import {
  PURCHASE_FORM_MESSAGES, PURCHASE_FORM_TEXTS, PURCHASE_SELECT_MOTION_OPTIONS,
} from './purchase-form.constants';
import type {
  PurchaseFieldWithError, PurchaseFormGroup, PurchaseFormSubmit, PurchaseServerErrors,
} from './purchase-form.models';

// Formulario de «Entrada a bodega» (HU-27). Es presentacional: los productos llegan por `products` y el
// envío sale por `submitted` con { productId, qty }; el requestId y el POST son de la página. Los
// errores de cada campo aparecen al enviar, nunca al tocar.
@Component({
  imports: [ReactiveFormsModule, InputText, ButtonDirective, Select],
  selector: 'app-purchase-form',
  templateUrl: './purchase-form.component.html',
})
export class PurchaseFormComponent implements OnInit {
  // --- Dependencias ---
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);

  // --- Entradas y salidas ---
  readonly products = input.required<PurchaseProduct[]>();
  readonly saving = input(false); // deshabilita «Registrar entrada» mientras el envío está en curso
  readonly serverErrors = input<PurchaseServerErrors>({});
  readonly notice = input<string | null>(null); // aviso general, justo encima de los botones
  readonly submitted = output<PurchaseFormSubmit>();
  readonly cancelled = output<void>();

  // --- Formulario y estados ---
  form!: PurchaseFormGroup;
  readonly texts = PURCHASE_FORM_TEXTS;
  readonly motionOptions = PURCHASE_SELECT_MOTION_OPTIONS;
  readonly selectedProductId = signal<number | null>(null);
  private readonly typedQty = signal('');
  private readonly fieldErrors = signal<Partial<Record<PurchaseFieldWithError, string>>>({});
  // Copia de los errores del servidor que se borra al cambiar ese campo; vuelve a llenarse cuando la
  // página manda errores nuevos.
  private readonly liveServerErrors = linkedSignal<PurchaseServerErrors>(() => this.serverErrors());

  readonly selectedProduct = computed<PurchaseProduct | null>(() =>
    this.products().find((product) => product.id === this.selectedProductId()) ?? null,
  );
  // «Piezas actuales en bodega: N» bajo el producto.
  readonly currentText = computed(() => {
    const product = this.selectedProduct();
    return product ? `${this.texts.currentStock}: ${unitsLabel(product.stock)}` : null;
  });
  // «Quedarán: N piezas» solo con un producto elegido y unas piezas válidas.
  readonly afterText = computed(() => {
    const product = this.selectedProduct();
    const qty = this.typedQty().trim();
    if (!product || !/^\d+$/.test(qty) || Number(qty) <= 0) return null;
    return `${this.texts.stockAfter}: ${unitsLabel(stockAfterPurchase(product.stock, Number(qty)))}`;
  });
  // Error del servidor gana al local; ambos se pintan en el mismo campo.
  readonly qtyError = computed(() => this.liveServerErrors().qty ?? this.fieldErrors().qty ?? null);
  readonly productError = computed(() => this.fieldErrors().product ?? null);
  // El error queda ligado al control con aria-describedby / aria-invalid (PrimeNG no lo pone solo).
  readonly productPassThrough = computed(() => describedSelect(this.productError(), 'product-error'));

  private readonly productSelect = viewChild<Select>('productInput');
  private readonly qtyInput = viewChild<ElementRef<HTMLInputElement>>('qtyInput');

  // --- Getters ---
  get productControl() {
    return this.form.controls.productId;
  }

  get qtyControl() {
    return this.form.controls.qty;
  }

  // --- Ciclo de vida ---
  ngOnInit(): void {
    this.form = this.createEmptyForm();
    this.listenToFieldChanges();
  }

  private createEmptyForm(): PurchaseFormGroup {
    return this.formBuilder.group({
      productId: this.formBuilder.control<number | null>(null, Validators.required),
      qty: this.formBuilder.control('', wholeQuantity()),
    });
  }

  // Escribir o elegir en un campo borra su error; elegir un producto actualiza las cifras de abajo.
  private listenToFieldChanges(): void {
    this.productControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((productId) => {
      this.selectedProductId.set(productId);
      this.clearFieldError('product');
    });
    this.qtyControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((qty) => {
      this.typedQty.set(qty);
      this.clearFieldError('qty');
    });
  }

  // --- Controles que cambia el usuario ---
  // p-select usa un span como combobox: la etiqueta necesita esta acción para llevar el foco.
  focusProduct(): void {
    if (!this.saving()) this.productSelect()?.focus();
  }

  // --- Validación, payload y envío ---
  // Inválido: marca todo como tocado, pinta el error de cada campo, lleva el foco al primero y no emite.
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
  private prepareSavePayload(): PurchaseFormSubmit {
    const raw = this.form.getRawValue();
    return { productId: Number(raw.productId), qty: Number(raw.qty.trim()) };
  }

  private validationErrors(): Partial<Record<PurchaseFieldWithError, string>> {
    const errors: Partial<Record<PurchaseFieldWithError, string>> = {};
    if (this.productControl.invalid) errors.product = PURCHASE_FORM_MESSAGES.product;
    if (this.qtyControl.invalid) {
      errors.qty = this.firstErrorMessage(this.qtyControl, PURCHASE_FORM_MESSAGES.qty);
    }
    return errors;
  }

  // Mensaje del primer validador que falló; si no hay uno propio, el genérico.
  private firstErrorMessage(control: AbstractControl, messages: Record<string, string>): string {
    const key = Object.keys(control.errors ?? {})[0];
    return (key && messages[key]) || PURCHASE_FORM_MESSAGES.invalid;
  }

  private focusFirstError(errors: Partial<Record<PurchaseFieldWithError, string>>): void {
    if (errors.product) this.productSelect()?.focus();
    else this.qtyInput()?.nativeElement.focus();
  }

  // Al cambiar un campo se borran su error local y el del servidor: el valor nuevo ya no es el rechazado.
  private clearFieldError(field: PurchaseFieldWithError): void {
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
