import type { RestockOrderSummary } from '../interfaces/restock.models';
import type { RestockHistoryItemView } from '../models/restock-history-page.models';

// Cierre más reciente primero; el empate se resuelve por id descendente.
export function sortClosedOrders(orders: RestockOrderSummary[]): RestockOrderSummary[] {
  throw new Error(`Sin implementar: ${orders.length}`);
}

export function historyItemView(order: RestockOrderSummary): RestockHistoryItemView {
  throw new Error(`Sin implementar: ${order.id}`);
}
