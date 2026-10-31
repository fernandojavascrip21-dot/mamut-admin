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
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { Observable } from 'rxjs';
import type { ViewingSeller } from '@core/viewing/interfaces/viewing.models';
import { MONEY_MAX } from '@shared/constants/money.constants';
import { initialsOf } from '@shared/utils/initials';
import type {
  DeliveryFormValue,
  DeliveryProduct,
  DeliveryProductSummary,
  SellerHolding,
} from '../../interfaces/delivery.models';
import {
  effectiveCost,
  effectivePrice,
  isBelowCost,
  previewBalances,
  profitPerUnit,
} from '../../rules/delivery.rules';
import { optionalMoney, positiveInteger } from '../../validators/delivery-form.validators';
import { DeliveryProductPickerComponent } from '../delivery-product-picker/delivery-product-picker.component';
import { FIELD_MESSAGES, MONEY_MESSAGES, NOT_ENOUGH_UNITS_ERROR } from './delivery-form.constants';
import type { DeliveryFormGroup, FieldWithError, HoldingStatus } from './delivery-form.models';

// Formulario de la ventana «Dejar a vendedor» (pantalla 03a, HU-11). Es presentacional: el
// vendedor, el producto y lo que el vendedor ya tiene llegan por `input()`, y la elección de
// vendedor o producto y el envío salen por `output()`; cargar datos, guardar y los estados de
// espera son de la página. Los errores de cada campo aparecen al enviar; solo «el precio es menor
// que el costo» se muestra en vivo, y avisa sin bloquear.
@Component({
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, DeliveryProductPickerComponent],
  selector: 'app-delivery-form',
  templateUrl: './delivery-form.component.html',
})
export class DeliveryFormComponent implements OnInit {
  // --- Dependencias ---
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);

  // --- Entradas y salidas ---
  readonly sellers = input<ViewingSeller[]>([]);
  readonly fixedSellerId = input<string | null>(null); // vendedor fijo (de la URL): no se puede cambiar
  readonly products = input<DeliveryProductSummary[]>([]); // para el buscador
  readonly fixedProduct = input(false); // producto fijo (de la URL): no hay buscador ni «Cambiar»
  readonly product = input<DeliveryProduct | null>(null);
  readonly productLoading = input(false);
  readonly holding = input<SellerHolding | null>(null);
  readonly holdingStatus = input<HoldingStatus>('idle');
  readonly saving = input(false); // cambia «Dejar» por «Dejando…» y bloquea el envío
  readonly notEnoughUnits = input(false); // 409: «No hay piezas suficientes» en el campo
  readonly cancelUrl = input.required<string>();
  readonly sellerPicked = output<string>();
  readonly productPicked = output<number>();
  readonly productCleared = output<void>();
  readonly holdingRetried = output<void>();
  readonly submitted = output<DeliveryFormValue>();

  // --- Formulario y estados ---
  form!: DeliveryFormGroup;

  // Lo que escribe el usuario, como señales, para la vista previa y la ganancia en vivo.
  private readonly qtyText = signal('');
  private readonly ownPriceText = signal('');
  private readonly ownCostText = signal('');
  private readonly selectedSellerId = signal('');

  private readonly fieldErrors = signal<Partial<Record<FieldWithError, string>>>({});
  private readonly serverQtyDismissed = signal(false);

  readonly sellerId = computed(() => this.fixedSellerId() ?? this.selectedSellerId());
  readonly sellerName = computed(
    () => this.sellers().find((seller) => seller.id === this.sellerId())?.fullName ?? '',
  );
  readonly sellerLabel = computed(() => this.sellerName() || 'Vendedor');

  // Piezas escritas: null mientras no sean un entero mayor a 0.
  private readonly qty = computed(() =>
    /^\d+$/.test(this.qtyText().trim()) ? Number(this.qtyText().trim()) : null,
  );
  readonly warehouseUnits = computed(() => this.product()?.stock ?? 0);
  readonly sellerUnits = computed(() => this.holding()?.units ?? 0);

  // Vista previa «Bodega: 10 → 4» y «Luis: 0 → 6»: solo con piezas válidas y que alcancen.
  readonly preview = computed(() => {
    const qty = this.qty();
    if (!this.product() || qty === null || qty <= 0 || qty > this.warehouseUnits()) return null;
    return previewBalances(this.warehouseUnits(), this.sellerUnits(), qty);
  });

  // Precio y costo que aplicarán: los propios si se escribieron (y son válidos) o los generales.
  readonly price = computed(() => {
    const product = this.product();
    return product ? effectivePrice(product.price, this.ownPriceText()) : null;
  });
  readonly cost = computed(() => {
    const product = this.product();
    return product ? effectiveCost(product.unitCost, this.ownCostText()) : null;
  });
  readonly profit = computed(() => {
    const price = this.price();
    const cost = this.cost();
    return price !== null && cost !== null ? Number(profitPerUnit(price, cost)) : null;
  });
  readonly belowCost = computed(() => {
    const price = this.price();
    const cost = this.cost();
    return price !== null && cost !== null && isBelowCost(price, cost);
  });

  readonly sellerError = computed(() => this.fieldErrors().sellerId ?? null);
  readonly productError = computed(() => this.fieldErrors().productId ?? null);
  readonly qtyError = computed(
    () =>
      this.fieldErrors().qty ??
      (this.notEnoughUnits() && !this.serverQtyDismissed() ? NOT_ENOUGH_UNITS_ERROR : null),
  );
  readonly unitCostError = computed(() => this.fieldErrors().unitCostWithShipping ?? null);
  readonly unitPriceError = computed(() => this.fieldErrors().unitPrice ?? null);

  readonly productInitials = computed(() => initialsOf(this.product()?.name ?? ''));
  readonly productImageBroken = signal(false);
  // El botón se habilita solo con un producto y piezas escritas (un entero mayor a 0): sin piezas no
  // hay nada que dejar. «idle» (todavía sin vendedor) sí deja enviar, para que el envío señale el
  // campo que falta; cargar o fallar lo que el vendedor ya tiene lo bloquea, porque la vista previa
  // y el prellenado dependen de eso.
  readonly canSubmit = computed(
    () =>
      !this.saving() &&
      this.product() !== null &&
      (this.qty() ?? 0) > 0 &&
      this.holdingStatus() !== 'loading' &&
      this.holdingStatus() !== 'error',
  );

  private readonly sellerSelect = viewChild<ElementRef<HTMLSelectElement>>('sellerSelect');
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

    // El producto elegido llega por input; el control solo refleja si hay uno (para validar).
    effect(() => {
      this.form.controls.productId.setValue(this.product()?.id ?? null, { emitEvent: false });
      this.productImageBroken.set(false);
    });

    // Lo que el vendedor ya tiene (sus precios propios) llena los dos campos; mientras carga o si
    // no hay producto, quedan vacíos. Vacío significa «usar el general» (RF-26, RF-27).
    effect(() => {
      const holding = this.holding();
      this.form.patchValue({
        unitPrice: holding?.unitPrice ?? '',
        unitCostWithShipping: holding?.unitCostWithShipping ?? '',
      });
    });

    // Un 409 nuevo vuelve a mostrar el error de piezas hasta que se escriba otra cantidad.
    effect(() => {
      if (this.notEnoughUnits()) this.serverQtyDismissed.set(false);
    });
  }

  // Primero la estructura vacía con sus reglas; después los datos que ya se conocen.
  ngOnInit(): void {
    this.form = this.createEmptyForm();
    this.listenToFieldChanges();
    this.loadInitialValue();
  }

  private createEmptyForm(): DeliveryFormGroup {
    return this.formBuilder.group({
      sellerId: this.formBuilder.control('', Validators.required),
      productId: new FormControl<number | null>(null, Validators.required),
      qty: this.formBuilder.control('', positiveInteger()),
      unitCostWithShipping: this.formBuilder.control('', optionalMoney(4, MONEY_MAX[4])),
      unitPrice: this.formBuilder.control('', optionalMoney(2, MONEY_MAX[2])),
    });
  }

  // Reacciones a lo que escribe el usuario: las señales de la vista previa siguen al formulario,
  // escribir en un campo borra su error, y elegir vendedor avisa a la página.
  private listenToFieldChanges(): void {
    const watch = (
      changes: Observable<string>,
      field: FieldWithError,
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
    this.form.controls.sellerId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        this.selectedSellerId.set(id);
        this.clearFieldError('sellerId');
        if (id !== '') this.sellerPicked.emit(id);
      });
  }

  // --- Carga de datos ---
  // Un vendedor fijo (de la URL) llena el control sin avisar a la página, que ya lo conoce.
  private loadInitialValue(): void {
    const fixed = this.fixedSellerId();
    if (fixed) this.form.controls.sellerId.setValue(fixed, { emitEvent: false });
  }

  // --- Controles que cambia el usuario ---
  onProductPicked(productId: number): void {
    this.clearFieldError('productId');
    this.productPicked.emit(productId);
  }

  clearProduct(): void {
    this.productCleared.emit();
  }

  // --- Validación, payload y envío ---
  // Si el formulario es inválido, marca todo como tocado, pinta el error de cada campo, lleva el
  // foco al primero y no envía. Si es válido, emite el payload.
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

  // Payload con los nombres que espera DeliverySaveService: piezas como entero y precio y costo
  // como texto sin espacios, o null si están vacíos (= usar el general; spec T-08).
  prepareSavePayload(): DeliveryFormValue {
    const raw = this.form.getRawValue();
    return {
      sellerId: this.sellerId(),
      productId: raw.productId ?? 0,
      qty: Number(raw.qty.trim()),
      unitPrice: raw.unitPrice.trim() || null,
      unitCostWithShipping: raw.unitCostWithShipping.trim() || null,
    };
  }

  private collectErrors(): Partial<Record<FieldWithError, string>> {
    const errors: Partial<Record<FieldWithError, string>> = {};
    if (this.sellerId() === '') errors.sellerId = FIELD_MESSAGES.sellerId;
    if (this.form.controls.productId.invalid) errors.productId = FIELD_MESSAGES.productId;
    if (this.qtyControl.invalid) errors.qty = FIELD_MESSAGES.qty;
    else if (this.qty()! > this.warehouseUnits()) errors.qty = NOT_ENOUGH_UNITS_ERROR;
    if (this.unitCostControl.invalid)
      errors.unitCostWithShipping = this.moneyError('unitCostWithShipping');
    if (this.unitPriceControl.invalid) errors.unitPrice = this.moneyError('unitPrice');
    return errors;
  }

  private focusFirstError(errors: Partial<Record<FieldWithError, string>>): void {
    const first = errors.sellerId
      ? this.sellerSelect()
      : errors.qty
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
    return FIELD_MESSAGES[field];
  }

  private clearFieldError(field: FieldWithError): void {
    if (this.fieldErrors()[field])
      this.fieldErrors.update((errors) => ({ ...errors, [field]: undefined }));
  }
}
