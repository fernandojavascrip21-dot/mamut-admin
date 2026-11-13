import { Component, input, output } from '@angular/core';
import type { FormControl, FormGroup } from '@angular/forms';
import type { PreviewLine, ReceiptCatalogItem } from '../../interfaces/receipt.models';

@Component({
  imports: [],
  selector: 'app-receipt-preview-line',
  templateUrl: './receipt-preview-line.component.html',
})
export class ReceiptPreviewLineComponent {
  readonly proposed = input.required<PreviewLine>();
  readonly group = input.required<FormGroup<{
    productId: FormControl<string>;
    qty: FormControl<string>;
    unitCost: FormControl<string>;
  }>>();
  readonly catalog = input.required<ReceiptCatalogItem[]>();
  readonly catalogError = input(false);
  readonly showErrors = input(false);
  // Bodega antes y después según la pantalla; null si la línea no tiene producto.
  readonly stockBefore = input<number | null>(null);
  readonly stockAfter = input<number | null>(null);
  readonly disabled = input(false);
  readonly removed = output<void>();
  readonly catalogRetry = output<void>();
}
