import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { compareMoney } from '@shared/utils/money';
import type { PendingCostChange } from '../../interfaces/receipt.models';

// Tarjeta de un cambio de costo pendiente (HU-42 §3). Solo muestra y emite: la página decide y confirma.
@Component({
  imports: [ButtonDirective, CurrencyPipe, RouterLink],
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

  // «Al recibir» solo se muestra si el costo de entonces difiere del actual.
  readonly showPreviousCost = computed(() => {
    const { previousUnitCost, currentUnitCost } = this.item();
    return compareMoney(previousUnitCost, 4, currentUnitCost, 4) !== 0;
  });

  // Un producto desactivado no admite cambio de costo: el backend lo rechazaría con 409.
  readonly inactive = computed(() => !this.item().product.active);
}
