import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { Observable } from 'rxjs';
import { MONEY_MAX } from '@shared/constants/money.constants';
import { initialsOf } from '@shared/utils/initials';
import type { DeliveryProduct, HoldingFormValue, SellerHolding } from '../../interfaces/delivery.models';
import {
  effectiveCost,
  effectivePrice,
  isBelowCost,
  previewHoldingChange,
  profitPerUnit,
} from '../../rules/delivery.rules';
import { nonNegativeInteger, optionalMoney } from '../../validators/delivery-form.validators';
import { MONEY_MESSAGES, NOT_ENOUGH_UNITS_ERROR } from '../delivery-form/delivery-form.constants';
import { HOLDING_FIELD_MESSAGES } from './holding-edit-form.constants';
import type { HoldingEditFormGroup, HoldingFieldWithError } from './holding-edit-form.models';

// Formulario de la ventana «Editar lo dejado»: corrige las piezas que tiene un vendedor de un
// producto y su precio y costo con envío. Es presentacional: el producto, lo que el vendedor ya tiene
// y el nombre llegan por `input()`, y el envío sale por `output()`; cargar datos y guardar son de la
// página. Las piezas son el total final (no la diferencia). Los errores aparecen al enviar; solo «el
// precio es menor que el costo» se muestra en vivo, y avisa sin bloquear.
@Component({
  imports: [ButtonDirective, InputText, ReactiveFormsModule, CurrencyPipe],
  selector: 'app-holding-edit-form',
  templateUrl: './holding-edit-form.component.html',
})
export class HoldingEditFormComponent implements OnInit {
  // --- Dependencias ---
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);

  // --- Entradas y salidas ---
  readonly sellerName = input.required<string>();
  readonly product = input.required<DeliveryProduct>();
  readonly holding = input.required<SellerHolding>();
  readonly saving = input(false); // cambia «Guardar» por «Guardando…» y bloquea el envío
  readonly notEnoughUnits = input(false); // 409: «No hay piezas suficientes» en el campo
  readonly submitted = output<HoldingFormValue>();
  readonly cancelled = output<void>(); // «Cancelar»: la página cierra el pop-up

  // --- Formulario y estados ---
  form!: HoldingEditFormGroup;

  // Lo que escribe el usuario, como señales, para la vista previa y la ganancia en vivo.
  private readonly qtyText = signal('');
  private readonly ownPriceText = signal('');
  private readonly ownCostText = signal('');

  private readonly fieldErrors = signal<Partial<Record<HoldingFieldWithError, string>>>({});
  private readonly serverQtyDismissed = signal(false);

  // Piezas escritas: null mientras no sean un entero de 0 o más.
  private readonly qty = computed(() =>
    /^\d+$/.test(this.qtyText().trim()) ? Number(this.qtyText().trim()) : null,
  );
  readonly warehouseUnits = computed(() => this.product().stock);
  readonly sellerUnits = computed(() => this.holding().units);

  // Vista previa «Bodega: 10 → 8» y «Luis: 3 → 5»: solo con piezas válidas y que la bodega alcance.
  readonly preview = computed(() => {
    const qty = this.qty();
    if (qty === null || qty === this.sellerUnits()) return null;
    return previewHoldingChange(this.warehouseUnits(), this.sellerUnits(), qty);
  });
  // Cuántas piezas puede tener el vendedor como máximo: las suyas más las que hay en la bodega.
  readonly maxUnits = computed(() => this.sellerUnits() + this.warehouseUnits());

  // Precio y costo que aplicarán: los propios si se escribieron (y son válidos) o los generales.
  readonly price = computed(() => effectivePrice(this.product().price, this.ownPriceText()));
  readonly cost = computed(() => effectiveCost(this.product().unitCost, this.ownCostText()));
  readonly profit = computed(() => Number(profitPerUnit(this.price(), this.cost())));
  readonly belowCost = computed(() => isBelowCost(this.price(), this.cost()));

  readonly qtyError = computed(
    () =>
      this.fieldErrors().qty ??
      (this.notEnoughUnits() && !this.serverQtyDismissed() ? NOT_ENOUGH_UNITS_ERROR : null),
  );
  readonly unitCostError = computed(() => this.fieldErrors().unitCostWithShipping ?? null);
  readonly unitPriceError = computed(() => this.fieldErrors().unitPrice ?? null);

  readonly productInitials = computed(() => initialsOf(this.product().name));
  readonly productImageBroken = signal(false);

  // El botón se habilita solo si algo cambió respecto de lo que el vendedor ya tiene: guardar lo
  // mismo no tiene sentido. Un texto inválido cuenta como cambio, para que el envío señale el error.
  readonly changed = computed(() => {
    const holding = this.holding();
    return (
      this.qtyText().trim() !== String(holding.units) ||
      this.ownPriceText().trim() !== (holding.unitPrice ?? '') ||
      this.ownCostText().trim() !== (holding.unitCostWithShipping ?? '')
    );
  });
  readonly canSubmit = computed(() => !this.saving() && this.changed());

  private readonly qtyInput = viewChild<ElementRef<HTMLInputElement>>('qtyInput');
  private readonly unitCostInput = viewChild<ElementRef<HTMLInputElement>>('unitCostInput');
  private readonly unitPriceInput = viewChild<ElementRef<HTMLInputElement>>('unitPriceInput');

  // --- Getters ---
  get qtyControl() {
    return this.form.controls.qty;
  }

  get unitCostControl() {
    return this.form.controls.unitCostWithShipping;
  }

  get unitPriceControl() {
    return this.form.controls.unitPrice;
  }

  // --- Ciclo de vida ---
  constructor() {
    // Mientras guarda, el formulario queda deshabilitado; tras un error se vuelve a habilitar.
    effect(() => {
      if (this.saving()) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
    });

    // Un 409 nuevo vuelve a mostrar el error de piezas hasta que se escriba otra cantidad.
    effect(() => {
      if (this.notEnoughUnits()) this.serverQtyDismissed.set(false);
    });
  }

  // Primero la estructura vacía con sus reglas; después lo que el vendedor ya tiene.
  ngOnInit(): void {
    this.form = this.createEmptyForm();
    this.listenToFieldChanges();
    this.loadInitialValue();
  }

  private createEmptyForm(): HoldingEditFormGroup {
    return this.formBuilder.group({
      qty: this.formBuilder.control('', nonNegativeInteger()),
      unitCostWithShipping: this.formBuilder.control('', optionalMoney(4, MONEY_MAX[4])),
      unitPrice: this.formBuilder.control('', optionalMoney(2, MONEY_MAX[2])),
    });
  }

  // Las señales de la vista previa siguen al formulario y escribir en un campo borra su error.
  private listenToFieldChanges(): void {
    const watch = (
      changes: Observable<string>,
      field: HoldingFieldWithError,
      target: { set(value: string): void },
    ) =>
      changes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
        target.set(value);
        this.clearFieldError(field);
      });
    watch(this.form.controls.qty.valueChanges, 'qty', this.qtyText);
    watch(this.form.controls.unitPrice.valueChanges, 'unitPrice', this.ownPriceText);
    watch(
      this.form.controls.unitCostWithShipping.valueChanges,
      'unitCostWithShipping',
      this.ownCostText,
    );
    this.form.controls.qty.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.serverQtyDismissed.set(true));
  }

  // --- Carga de datos ---
  // Prellena con lo vigente; vacío en precio o costo significa «usa el general».
  private loadInitialValue(): void {
    const holding = this.holding();
    this.form.patchValue({
      qty: String(holding.units),
      unitPrice: holding.unitPrice ?? '',
      unitCostWithShipping: holding.unitCostWithShipping ?? '',
    });
  }

  // --- Validación, payload y envío ---
  // Si el formulario es inválido, pinta el error de cada campo, lleva el foco al primero y no envía.
  onSubmit(): void {
    if (!this.canSubmit()) return;
    this.form.markAllAsTouched();
    const errors = this.collectErrors();
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length > 0) {
      this.focusFirstError(errors);
      return;
    }
    this.submitted.emit(this.prepareSavePayload());
  }

  // Piezas como entero y precio y costo como texto sin espacios, o null si están vacíos (= usar el
  // general; spec T-08).
  prepareSavePayload(): HoldingFormValue {
    const raw = this.form.getRawValue();
    return {
      qty: Number(raw.qty.trim()),
      unitPrice: raw.unitPrice.trim() || null,
      unitCostWithShipping: raw.unitCostWithShipping.trim() || null,
    };
  }

  private collectErrors(): Partial<Record<HoldingFieldWithError, string>> {
    const errors: Partial<Record<HoldingFieldWithError, string>> = {};
    if (this.qtyControl.invalid) errors.qty = HOLDING_FIELD_MESSAGES.qty;
    else if (this.qty()! > this.maxUnits()) errors.qty = NOT_ENOUGH_UNITS_ERROR;
    if (this.unitCostControl.invalid)
      errors.unitCostWithShipping = this.moneyError('unitCostWithShipping');
    if (this.unitPriceControl.invalid) errors.unitPrice = this.moneyError('unitPrice');
    return errors;
  }

  private focusFirstError(errors: Partial<Record<HoldingFieldWithError, string>>): void {
    const first = errors.qty
      ? this.qtyInput()
      : errors.unitCostWithShipping
        ? this.unitCostInput()
        : this.unitPriceInput();
    first?.nativeElement.focus();
  }

  // Mensaje del campo de dinero: primero el más específico (decimales, monto grande), después
  // «mayor a 0», que también cubre un texto que no es decimal.
  private moneyError(field: 'unitCostWithShipping' | 'unitPrice'): string {
    const control = this.form.controls[field];
    if (control.hasError('maxDecimals')) return MONEY_MESSAGES[field].maxDecimals;
    if (control.hasError('maxMoney')) return MONEY_MESSAGES[field].maxMoney;
    return HOLDING_FIELD_MESSAGES[field];
  }

  private clearFieldError(field: HoldingFieldWithError): void {
    if (this.fieldErrors()[field])
      this.fieldErrors.update((errors) => ({ ...errors, [field]: undefined }));
  }
}
