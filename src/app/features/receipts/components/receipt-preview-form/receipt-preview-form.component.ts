import { Component, input, output } from '@angular/core';
import type { ConfirmReceiptPayload, ReceiptCatalogItem, ReceiptPreview } from '../../interfaces/receipt.models';

@Component({
  imports: [],
  selector: 'app-receipt-preview-form',
  templateUrl: './receipt-preview-form.component.html',
})
export class ReceiptPreviewFormComponent {
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
}
