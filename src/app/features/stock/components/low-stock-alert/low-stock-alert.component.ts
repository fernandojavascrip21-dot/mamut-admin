import { Component, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { STOCK_LEVEL_LABELS } from '@shared/constants/stock-level.constants';
import { LOW_STOCK_ALERT_TEXTS } from './low-stock-alert.constants';
import type { LowStockAlertItem } from './low-stock-alert.models';

// Tarjeta ámbar de «Stock general» (HU-18) con los productos de baja o nula existencia y de quién son.
// Presentacional: la página decide qué avisos y qué título; aquí solo se pintan. El «Agotado» lleva
// texto además del color, para que el color nunca sea lo único que informa. La X avisa con `dismissed`;
// quien la usa decide cuánto tiempo queda cerrada.
@Component({
  imports: [ButtonDirective],
  selector: 'app-low-stock-alert',
  templateUrl: './low-stock-alert.component.html',
})
export class LowStockAlertComponent {
  readonly title = input.required<string>();
  readonly items = input.required<LowStockAlertItem[]>();

  readonly dismissed = output<void>();

  readonly outLabel = STOCK_LEVEL_LABELS.out;
  readonly texts = LOW_STOCK_ALERT_TEXTS;
}
