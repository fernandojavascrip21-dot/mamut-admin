import { Component, computed, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { unitsLabel } from '@shared/utils/units-label';
import type { Purchase } from '../../interfaces/purchase.models';
import { PURCHASE_RESULT_TEXTS } from './purchase-result.constants';

// Resultado de «Entrada a bodega» (HU-27): muestra lo que devolvió el backend, sin calcular nada. El
// «antes → después» viene de los movimientos, así que también vale cuando la respuesta es repetida.
@Component({
  imports: [ButtonDirective],
  selector: 'app-purchase-result',
  templateUrl: './purchase-result.component.html',
})
export class PurchaseResultComponent {
  readonly purchase = input.required<Purchase>();
  readonly again = output<void>();
  readonly closed = output<void>();
  readonly texts = PURCHASE_RESULT_TEXTS;

  readonly quantity = computed(() => `+ ${unitsLabel(this.purchase().qty)}`);
  readonly initial = computed(() => this.purchase().product.name.charAt(0));
}
