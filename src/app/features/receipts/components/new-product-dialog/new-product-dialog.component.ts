import { Component, input, output } from '@angular/core';
import type {
  CreateProductFromLinePayload, PendingNewProduct, ReceiptCategory,
} from '../../interfaces/receipt.models';

@Component({
  imports: [],
  selector: 'app-new-product-dialog',
  templateUrl: './new-product-dialog.component.html',
})
export class NewProductDialogComponent {
  readonly item = input.required<PendingNewProduct>();
  readonly categories = input.required<ReceiptCategory[]>();
  readonly saving = input(false);
  // Errores que decide el backend: el nombre repetido (409) y los demás (422) arriba del formulario.
  readonly nameError = input<string | null>(null);
  readonly formError = input<string | null>(null);
  readonly saved = output<CreateProductFromLinePayload>();
  readonly closed = output<void>();
}
