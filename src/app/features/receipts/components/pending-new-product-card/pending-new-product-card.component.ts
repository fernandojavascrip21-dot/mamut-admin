import { Component, input, output } from '@angular/core';
import type { PendingNewProduct } from '../../interfaces/receipt.models';

@Component({
  imports: [],
  selector: 'app-pending-new-product-card',
  templateUrl: './pending-new-product-card.component.html',
})
export class PendingNewProductCardComponent {
  readonly item = input.required<PendingNewProduct>();
  readonly busy = input(false);
  readonly createRequested = output<void>();
  readonly discardRequested = output<void>();
}
