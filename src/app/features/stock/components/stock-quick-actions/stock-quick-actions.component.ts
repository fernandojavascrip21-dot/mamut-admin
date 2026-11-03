import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import type { StockQuickAction } from './stock-quick-actions.models';

// Rejilla de movimientos rápidos de «Stock general» (HU-13): un enlace con aspecto de botón por
// acción. No decide a dónde lleva cada una; la página le pasa los enlaces ya armados.
@Component({
  imports: [RouterLink, ButtonDirective],
  selector: 'app-stock-quick-actions',
  templateUrl: './stock-quick-actions.component.html',
})
export class StockQuickActionsComponent {
  readonly actions = input.required<StockQuickAction[]>();
}
