import { Component, input, output } from '@angular/core';
import type { Receipt } from '../../interfaces/receipt.models';

@Component({
  imports: [],
  selector: 'app-receipt-result',
  templateUrl: './receipt-result.component.html',
})
export class ReceiptResultComponent {
  readonly receipt = input.required<Receipt>();
  // Piezas de bodega que tenía la pantalla antes de confirmar, por id de producto.
  readonly stockBefore = input<Record<number, number>>({});
  readonly another = output<void>();
  readonly closed = output<void>();
  readonly pendingRequested = output<void>();
}
