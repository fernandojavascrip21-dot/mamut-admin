import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { compareMoney } from '@shared/utils/money';
import type { CreateProductFromLinePayload, PendingNewProduct, ReceiptCategory } from '../../interfaces/receipt.models';
import { newProductName, productPrice, productUnitCost } from '../../validators/new-product.validators';
import { NEW_PRODUCT_DIALOG_TEXTS, NEW_PRODUCT_FIELD_ERRORS } from './new-product-dialog.constants';
import type { NewProductField, NewProductFormGroup, NewProductLiveValues } from './new-product-dialog.models';

// «Dar de alta producto» (HU-42 §3): alta corta de un producto nuevo que sale de una remisión. Es
// presentacional: la página guarda, y `saving` / `nameError` / `formError` llegan de ella. Un solo envío:
// mientras guarda no se puede cerrar ni volver a enviar.
@Component({
  imports: [ButtonDirective, InputText, ModalPanelComponent, ReactiveFormsModule, Select],
  selector: 'app-new-product-dialog',
  templateUrl: './new-product-dialog.component.html',
})
export class NewProductDialogComponent implements OnInit {
  // --- Dependencias ---
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  // --- Entradas y salidas ---
  readonly item = input.required<PendingNewProduct>();
  readonly categories = input.required<ReceiptCategory[]>();
  readonly saving = input(false);
  // Errores que decide el backend: el nombre repetido (409) se marca en su campo; los demás (422), arriba.
  readonly nameError = input<string | null>(null);
  readonly formError = input<string | null>(null);
  readonly saved = output<CreateProductFromLinePayload>();
  readonly closed = output<void>();

  readonly texts = NEW_PRODUCT_DIALOG_TEXTS;

  // --- Formulario y estados ---
  form!: NewProductFormGroup;
  // Los errores de campo se muestran al enviar, no al tocar.
  readonly submitted = signal(false);
  private readonly live = signal<NewProductLiveValues>({ price: '', unitCost: '' });

  readonly stockNote = computed(() => this.texts.stockNote(this.item().qty));
  readonly categoryOptions = computed(() => [
    { label: this.texts.noCategory, value: '' },
    ...this.categories().map((category) => ({ label: category.name, value: String(category.id) })),
  ]);
  // Regla en vivo, como en el formulario de producto: avisa, pero no bloquea el envío.
  readonly belowCost = computed(() => {
    const { price, unitCost } = this.live();
    return compareMoney(price.trim(), 2, unitCost.trim(), 4) === -1;
  });

  ngOnInit(): void {
    this.createEmptyForm();
    this.loadInitialValue();
  }

  // El costo es obligatorio solo si la remisión no trajo uno.
  private createEmptyForm(): void {
    this.form = this.formBuilder.nonNullable.group({
      name: ['', newProductName()],
      price: ['', productPrice()],
      categoryId: [''],
      unitCost: ['', productUnitCost(this.item().unitCost === null)],
    });
  }

  // Lo que leyó la remisión llena el nombre y el costo; el administrador lo corrige si hace falta.
  private loadInitialValue(): void {
    const item = this.item();
    this.form.patchValue({ name: item.suggestedName, unitCost: item.unitCost ?? '' });
    this.live.set(this.form.getRawValue());
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.live.set(this.form.getRawValue()));
  }

  // --- Envío ---
  submit(): void {
    if (this.saving()) return;
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saved.emit(this.prepareSavePayload());
  }

  // El costo viaja solo si cambió o si la remisión no traía uno: el backend no reescribe un costo sin motivo.
  private prepareSavePayload(): CreateProductFromLinePayload {
    const { name, price, categoryId, unitCost } = this.form.getRawValue();
    const payload: CreateProductFromLinePayload = {
      name: name.trim(),
      price: price.trim(),
      categoryId: categoryId === '' ? null : Number(categoryId),
    };
    const cost = unitCost.trim();
    const readCost = this.item().unitCost;
    if (cost !== '' && (readCost === null || compareMoney(cost, 4, readCost, 4) !== 0)) {
      payload.unitCost = cost;
    }
    return payload;
  }

  // Mensaje del primer error del campo, o null si no debe mostrarse todavía.
  errorOf(field: NewProductField): string | null {
    const control = this.form.controls[field];
    if (!this.submitted() || control.valid) return null;
    const key = Object.keys(control.errors ?? {})[0];
    return key === undefined ? null : (NEW_PRODUCT_FIELD_ERRORS[field][key] ?? null);
  }
}
