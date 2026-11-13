import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import type { PendingNewProduct } from '../../interfaces/receipt.models';
import { formatReceiptDate } from '../../rules/receipt-dates.rules';

// Tarjeta de un producto nuevo que espera alta (HU-42 §3). Solo muestra y emite: la página decide.
@Component({
  imports: [ButtonDirective, CurrencyPipe],
  selector: 'app-pending-new-product-card',
  templateUrl: './pending-new-product-card.component.html',
})
export class PendingNewProductCardComponent {
  readonly item = input.required<PendingNewProduct>();
  readonly busy = input(false);
  readonly createRequested = output<void>();
  readonly discardRequested = output<void>();

  // Fecha de la remisión en la hora de la bodega, no en la del equipo.
  readonly dateLabel = computed(() => formatReceiptDate(this.item().receipt.createdAt));
}
