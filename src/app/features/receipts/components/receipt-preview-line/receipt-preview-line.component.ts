import { Component, DestroyRef, computed, effect, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, type ValidationErrors } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { startWith } from 'rxjs';
import type { PreviewLine, ReceiptCatalogItem } from '../../interfaces/receipt.models';
import { costChanged } from '../../rules/receipt-preview.rules';
import type { ReceiptLineFormGroup } from '../receipt-preview-form/receipt-preview-form.models';
import { RECEIPT_LINE_TEXTS } from './receipt-preview-line.constants';

// Un renglón de la vista previa: nombre leído, producto (con «Producto nuevo»), piezas, costo, bodega y
// el aviso de costo distinto. Es OnPush y el formulario cambia por fuera de la plantilla, así que los
// valores del grupo se copian a señales: la plantilla se repinta cuando cambian.
@Component({
  imports: [ReactiveFormsModule, ButtonDirective, InputText, Select],
  selector: 'app-receipt-preview-line',
  templateUrl: './receipt-preview-line.component.html',
})
export class ReceiptPreviewLineComponent implements OnInit {
  readonly proposed = input.required<PreviewLine>();
  readonly group = input.required<ReceiptLineFormGroup>();
  readonly catalog = input.required<ReceiptCatalogItem[]>();
  readonly catalogError = input(false);
  readonly showErrors = input(false);
  // Bodega antes y después según la pantalla; null si la línea no tiene producto.
  readonly stockBefore = input<number | null>(null);
  readonly stockAfter = input<number | null>(null);
  readonly disabled = input(false);
  readonly removed = output<void>();
  readonly catalogRetry = output<void>();

  readonly texts = RECEIPT_LINE_TEXTS;
  private readonly destroyRef = inject(DestroyRef);

  readonly productId = signal('');
  readonly qty = signal('');
  readonly unitCost = signal('');
  readonly qtyErrors = signal<ValidationErrors | null>(null);
  readonly costErrors = signal<ValidationErrors | null>(null);

  // «Producto nuevo» va primero y su valor es '' (así lo lee el formulario al armar el payload).
  readonly options = computed(() => [
    { value: '', label: RECEIPT_LINE_TEXTS.newProduct, image: null },
    ...this.catalog().map((product) => ({ value: String(product.id), label: product.name, image: product.image })),
  ]);

  readonly catalogProduct = computed(
    () => this.catalog().find((product) => String(product.id) === this.productId()) ?? null,
  );

  // «Reconocido» solo si el producto sigue siendo el que emparejó el backend; cambiarlo a mano es «Elegido por ti».
  readonly statusLabel = computed(() => {
    const id = this.productId();
    if (id === '') return RECEIPT_LINE_TEXTS.newProduct;
    const proposed = this.proposed();
    if (proposed.match !== 'none' && id === String(proposed.product?.id)) return RECEIPT_LINE_TEXTS.recognized;
    return RECEIPT_LINE_TEXTS.chosen;
  });

  readonly stockVisible = computed(
    () => this.productId() !== '' && this.stockBefore() !== null && this.stockAfter() !== null,
  );

  // El aviso se calcula en vivo con el mismo criterio que el backend (compareMoney, escala 4).
  readonly costDiffers = computed(() =>
    costChanged({ productId: this.productId(), qty: this.qty(), unitCost: this.unitCost() }, this.catalogProduct()),
  );

  readonly qtyMessage = computed(() => {
    const errors = this.qtyErrors();
    if (!errors) return null;
    if (errors['required']) return RECEIPT_LINE_TEXTS.qtyRequired;
    if (errors['tooLarge']) return RECEIPT_LINE_TEXTS.qtyTooLarge;
    return RECEIPT_LINE_TEXTS.qtyInteger;
  });

  readonly costMessage = computed(() => (this.costErrors() ? RECEIPT_LINE_TEXTS.costInvalid : null));

  constructor() {
    // Un renglón deshabilitado (mientras confirma) no se edita. Sin evento: no es un cambio del usuario.
    effect(() => {
      const group = this.group();
      if (this.disabled()) group.disable({ emitEvent: false });
      else group.enable({ emitEvent: false });
    });
  }

  ngOnInit(): void {
    const group = this.group();
    group.valueChanges
      .pipe(startWith(null), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.sync(group));
  }

  private sync(group: ReceiptLineFormGroup): void {
    const value = group.getRawValue();
    this.productId.set(value.productId);
    this.qty.set(value.qty);
    this.unitCost.set(value.unitCost);
    this.qtyErrors.set(group.controls.qty.errors);
    this.costErrors.set(group.controls.unitCost.errors);
  }
}
