import { Component, input, output } from '@angular/core';
import type { PendingCostChange } from '../../interfaces/receipt.models';

@Component({
  imports: [],
  selector: 'app-pending-cost-change-card',
  templateUrl: './pending-cost-change-card.component.html',
})
export class PendingCostChangeCardComponent {
  readonly item = input.required<PendingCostChange>();
  readonly busy = input(false);
  // true tras un «COST_ABOVE_PRICE»: la tarjeta ofrece el enlace «Editar producto».
  readonly showEditLink = input(false);
  readonly acceptRequested = output<void>();
  readonly rejectRequested = output<void>();
}
