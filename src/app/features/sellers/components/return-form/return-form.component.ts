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
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { initialsOf } from '@shared/utils/initials';
import { unitsLabel } from '@shared/utils/units-label';
import { RETURN_FIELD_MESSAGES } from '../../constants/sellers.constants';
import type { ReturnFormValue, SellerStockLine } from '../../interfaces/seller.models';
import { previewReturnBalances } from '../../rules/return.rules';
import { maxUnits, wholePositiveUnits } from '../../validators/return-form.validators';
import type {
  ReturnFieldWithError,
  ReturnFormGroup,
  ReturnProductOption,
} from './return-form.models';

// Formulario de «Retirar producto» (HU-12). Es presentacional: el stock del vendedor llega por
// `input()` y el envío sale por `output()`; cargar datos, guardar y los estados de espera son de la
// página. Los errores de cada campo aparecen al enviar, no al tocar el campo, y el botón solo se
// bloquea mientras guarda para que esos errores se puedan ver.
@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-return-form',
  templateUrl: './return-form.component.html',
})
export class ReturnFormComponent implements OnInit {
  // --- Dependencias ---
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);

  // --- Entradas y salidas ---
  readonly sellerName = input.required<string>();
  readonly stock = input<SellerStockLine[]>([]); // lo que el vendedor tiene en mano (units > 0)
  readonly saving = input(false); // cambia «Retirar» por «Retirando…» y bloquea el envío
  readonly notEnoughUnits = input(false); // 409: «No hay piezas suficientes» en el campo
  readonly cancelUrl = input.required<string>();
  readonly submitted = output<ReturnFormValue>();

  // --- Formulario y estados ---
  form!: ReturnFormGroup;

  // Lo que escribe el usuario, como señales, para la vista previa en vivo.
  private readonly selectedProductId = signal<number | null>(null);
  private readonly qtyText = signal('');
  private readonly fieldErrors = signal<Partial<Record<ReturnFieldWithError, string>>>({});
  private readonly serverQtyDismissed = signal(false);

  readonly options = computed<ReturnProductOption[]>(() =>
    this.stock().map((line) => ({ id: line.productId, label: `${line.name} · ${unitsLabel(line.units)}` })),
  );
  readonly line = computed(
    () => this.stock().find((line) => line.productId === this.selectedProductId()) ?? null,
  );
  readonly sellerUnits = computed(() => this.line()?.units ?? 0);
  readonly warehouseUnits = computed(() => this.line()?.warehouseUnits ?? 0);
  readonly lineInitials = computed(() => initialsOf(this.line()?.name ?? ''));
  readonly imageBroken = signal(false);

  // Piezas escritas: null mientras no sean un entero mayor a 0.
  private readonly qty = computed(() =>
    /^\d+$/.test(this.qtyText().trim()) ? Number(this.qtyText().trim()) : null,
  );

  // Vista previa «Luis: 6 → 4» y «Bodega: 4 → 6»: solo con piezas válidas que no pasen de las del vendedor.
  readonly preview = computed(() => {
    const qty = this.qty();
    if (!this.line() || qty === null || qty <= 0 || qty > this.sellerUnits()) return null;
    return previewReturnBalances(this.sellerUnits(), this.warehouseUnits(), qty);
  });

  readonly productError = computed(() => this.fieldErrors().productId ?? null);
  readonly qtyError = computed(
    () =>
      this.fieldErrors().qty ??
      (this.notEnoughUnits() && !this.serverQtyDismissed() ? RETURN_FIELD_MESSAGES.maxUnits : null),
  );

  private readonly productSelect = viewChild<ElementRef<HTMLSelectElement>>('productSelect');
  private readonly qtyInput = viewChild<ElementRef<HTMLInputElement>>('qtyInput');

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

    // Si el stock se vuelve a cargar (tras un 409) con otras piezas, las piezas escritas se vuelven
    // a validar contra lo nuevo.
    effect(() => {
      this.stock();
      this.form?.controls.qty.updateValueAndValidity({ emitEvent: false });
    });
  }

  // Primero la estructura vacía con sus reglas; después las reacciones a lo que escribe el usuario.
  ngOnInit(): void {
    this.form = this.createEmptyForm();
    this.listenToFieldChanges();
  }

  private createEmptyForm(): ReturnFormGroup {
    return this.formBuilder.group({
      productId: new FormControl<number | null>(null, Validators.required),
      qty: this.formBuilder.control('', [
        wholePositiveUnits(),
        maxUnits(() => (this.line() ? this.sellerUnits() : null)),
      ]),
    });
  }

  // Las señales de la vista previa siguen al formulario, y escribir en un campo borra su error.
  private listenToFieldChanges(): void {
    this.form.controls.productId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        this.selectedProductId.set(id);
        this.imageBroken.set(false);
        this.clearFieldError('productId');
        // Las piezas ya escritas se validan contra el producto nuevo.
        this.form.controls.qty.updateValueAndValidity({ emitEvent: false });
      });
    this.form.controls.qty.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.qtyText.set(value);
        this.serverQtyDismissed.set(true);
        this.clearFieldError('qty');
      });
  }

  // --- Validación, payload y envío ---
  // Si el formulario es inválido, marca todo como tocado, pinta el error de cada campo, lleva el
  // foco al primero y no envía. Si es válido, emite el payload.
  onSubmit(): void {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    const errors = this.collectErrors();
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length > 0) {
      (errors.productId ? this.productSelect() : this.qtyInput())?.nativeElement.focus();
      return;
    }
    this.submitted.emit(this.prepareSavePayload());
  }

  // Payload con los nombres que espera ReturnSaveService: producto y piezas como números.
  prepareSavePayload(): ReturnFormValue {
    const raw = this.form.getRawValue();
    return { productId: raw.productId ?? 0, qty: Number(raw.qty.trim()) };
  }

  private collectErrors(): Partial<Record<ReturnFieldWithError, string>> {
    const errors: Partial<Record<ReturnFieldWithError, string>> = {};
    const { productId, qty } = this.form.controls;
    if (productId.invalid) errors.productId = RETURN_FIELD_MESSAGES.product;
    if (qty.hasError('wholePositiveUnits')) errors.qty = RETURN_FIELD_MESSAGES.qty;
    else if (qty.hasError('maxUnits')) errors.qty = RETURN_FIELD_MESSAGES.maxUnits;
    return errors;
  }

  private clearFieldError(field: ReturnFieldWithError): void {
    if (this.fieldErrors()[field])
      this.fieldErrors.update((errors) => ({ ...errors, [field]: undefined }));
  }
}
