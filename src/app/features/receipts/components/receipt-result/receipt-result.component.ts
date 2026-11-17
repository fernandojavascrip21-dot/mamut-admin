import { Component, computed, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import type { Receipt } from '../../interfaces/receipt.models';
import { RECEIPT_RESULT_TEXTS } from './receipt-result.constants';
import type { ReceiptResultEntry } from './receipt-result.models';

// Resultado de una remisión registrada (HU-42 §3): las entradas con su bodega antes → después y los
// renglones que quedaron pendientes. La bodega «antes» la pone la página (es lo que tenía la pantalla).
@Component({
  imports: [ButtonDirective],
  selector: 'app-receipt-result',
  templateUrl: './receipt-result.component.html',
})
export class ReceiptResultComponent {
  readonly texts = RECEIPT_RESULT_TEXTS;
  readonly receipt = input.required<Receipt>();
  // Piezas de bodega que tenía la pantalla antes de confirmar, por id de producto.
  readonly stockBefore = input<Record<number, number>>({});
  readonly another = output<void>();
  readonly closed = output<void>();
  readonly pendingRequested = output<void>();

  // Solo los renglones que sumaron piezas: un producto nuevo queda pendiente y todavía no entra a bodega,
  // y un renglón por completar no tiene piezas todavía (qty null).
  readonly entries = computed<ReceiptResultEntry[]>(() => {
    const { lines, units } = this.receipt();
    return lines.flatMap((line) => {
      if (line.status !== 'received' || line.qty === null) return [];
      const productId = line.product?.id ?? null;
      return [{
        id: line.id,
        name: line.product?.name ?? line.readName,
        qty: line.qty,
        before: productId === null ? null : (this.stockBefore()[productId] ?? null),
        after: productId === null ? null : (units.find((unit) => unit.productId === productId)?.units ?? null),
      }];
    });
  });

  readonly pendingNew = computed(() => this.receipt().lines.filter((line) => line.status === 'pending').length);
  readonly pendingCost = computed(() => this.receipt().lines.filter((line) => line.costStatus === 'pending').length);
  readonly pendingIncomplete = computed(() => this.receipt().lines.filter((line) => line.status === 'incomplete').length);
  readonly pendingTotal = computed(() => this.pendingNew() + this.pendingCost() + this.pendingIncomplete());
}
