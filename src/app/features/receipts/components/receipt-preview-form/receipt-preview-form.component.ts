import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { receiptQty, receiptUnitCost } from '../../validators/receipt-line.validators';
import type {
  ConfirmReceiptPayload, PreviewLine, ReceiptCatalogItem, ReceiptPreview,
} from '../../interfaces/receipt.models';
import {
  buildConfirmPayload, costChanged, stockAfter, stockBefore, validQty,
} from '../../rules/receipt-preview.rules';
import { ReceiptSkippedListComponent } from '../receipt-skipped-list/receipt-skipped-list.component';
import { ReceiptPreviewLineComponent } from '../receipt-preview-line/receipt-preview-line.component';
import type { ReceiptLineFormGroup, ReceiptLineRow } from './receipt-preview-form.models';
import { RECEIPT_PREVIEW_FORM_TEXTS } from './receipt-preview-form.constants';

// Revisión de la remisión antes de registrarla (HU-42 §3). Presentacional: recibe la vista previa y el
// catálogo, y emite el payload al confirmar. Quien guarda es la página. Los renglones son un FormArray
// con un grupo por línea propuesta; `rows` guarda la línea de la que sale cada grupo, en el mismo orden.
@Component({
  imports: [ReactiveFormsModule, ButtonDirective, ReceiptPreviewLineComponent, ReceiptSkippedListComponent],
  selector: 'app-receipt-preview-form',
  templateUrl: './receipt-preview-form.component.html',
})
export class ReceiptPreviewFormComponent implements OnInit {
  readonly preview = input.required<ReceiptPreview>();
  readonly catalog = input.required<ReceiptCatalogItem[]>();
  readonly catalogError = input(false);
  readonly requestId = input.required<string>();
  readonly fileName = input<string | null>(null);
  readonly disabled = input(false);
  readonly confirmed = output<ConfirmReceiptPayload>();
  readonly catalogRetry = output<void>();
  // true al primer cambio del usuario; una vista previa recién cargada no cuenta.
  readonly dirtyChange = output<boolean>();

  readonly texts = RECEIPT_PREVIEW_FORM_TEXTS;
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly lines = this.fb.array<ReceiptLineFormGroup>([]);
  readonly rows = signal<ReceiptLineRow[]>([]);
  // Se enciende al confirmar con errores: a partir de ahí los renglones muestran sus mensajes.
  readonly showErrors = signal(false);
  // Sube con cada edición o renglón quitado; la barra y los cálculos se rehacen desde aquí.
  private readonly edits = signal(0);

  // Barra inferior: piezas válidas, productos nuevos y cambios de costo (los mismos criterios que el backend).
  readonly summary = computed(() => {
    this.edits();
    const values = this.lines.getRawValue();
    return {
      lines: values.length,
      pieces: values.reduce((total, value) => total + (validQty(value.qty) ?? 0), 0),
      newProducts: values.filter((value) => value.productId === '').length,
      costChanges: values.filter((value) => costChanged(value, this.catalogProduct(value.productId))).length,
    };
  });

  ngOnInit(): void {
    this.createEmptyForm();
    this.loadPreview(this.preview());
  }

  // Escucha las ediciones del usuario. Quitar un renglón también emite, así que cuenta como cambio.
  private createEmptyForm(): void {
    this.lines.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.edits.update((count) => count + 1);
      this.dirtyChange.emit(true);
    });
  }

  // Carga los renglones propuestos sin emitir: no son una edición del usuario.
  private loadPreview(preview: ReceiptPreview): void {
    const rows = preview.lines.map((line) => ({ proposed: line, group: this.createLineGroup(line) }));
    for (const row of rows) this.lines.push(row.group, { emitEvent: false });
    this.rows.set(rows);
  }

  private createLineGroup(line: PreviewLine): ReceiptLineFormGroup {
    return this.fb.group({
      productId: this.fb.control(line.product ? String(line.product.id) : '', { nonNullable: true }),
      qty: this.fb.control(String(line.qty), { nonNullable: true, validators: [receiptQty()] }),
      unitCost: this.fb.control(line.unitCost ?? '', { nonNullable: true, validators: [receiptUnitCost()] }),
    });
  }

  removeLine(index: number): void {
    this.lines.removeAt(index);
    this.rows.update((rows) => rows.filter((_, position) => position !== index));
  }

  // Bodega antes y después para el producto de un renglón; null si es «Producto nuevo».
  stockBeforeOf(productId: string): number | null {
    return productId === '' ? null : stockBefore(Number(productId), this.preview(), this.catalog());
  }

  stockAfterOf(productId: string): number | null {
    if (productId === '') return null;
    return stockAfter(Number(productId), this.preview(), this.catalog(), this.lines.getRawValue());
  }

  // Con errores no se emite: se muestran en los renglones. El backend vuelve a validar todo al confirmar.
  confirm(): void {
    if (this.disabled() || this.rows().length === 0) return;
    this.showErrors.set(true);
    if (this.lines.invalid) return;
    this.confirmed.emit(buildConfirmPayload({
      requestId: this.requestId(),
      source: this.preview().source,
      fileName: this.fileName(),
      proposed: this.rows().map((row) => row.proposed),
      values: this.lines.getRawValue(),
    }));
  }

  private catalogProduct(productId: string): ReceiptCatalogItem | null {
    return this.catalog().find((product) => String(product.id) === productId) ?? null;
  }
}
