import { RESTOCK_CLOSED_LABEL } from '../constants/restock.constants';
import type { RestockOrderSummary } from '../interfaces/restock.models';
import type { RestockHistoryItemView } from '../models/restock-history-page.models';
import { closedOrSavedAt, formatRestockDate } from './restock-dates.rules';
import { restockCountsLabel } from './restock-export.rules';

// Cierre más reciente primero; el empate se resuelve por id descendente. Trabaja sobre una copia
// porque el backend entrega por createdAt y la lista de la pantalla no debe reordenar el original.
export function sortClosedOrders(orders: RestockOrderSummary[]): RestockOrderSummary[] {
  return [...orders].sort(
    (a, b) => Date.parse(closedOrSavedAt(b)) - Date.parse(closedOrSavedAt(a)) || b.id - a.id,
  );
}

// Renglón de la lista: los textos de fecha y conteo salen de reglas puras, el total es el del backend.
export function historyItemView(order: RestockOrderSummary): RestockHistoryItemView {
  return {
    id: order.id,
    closedLabel: `${RESTOCK_CLOSED_LABEL} ${formatRestockDate(closedOrSavedAt(order))}`,
    countsLabel: restockCountsLabel(order.lineCount, order.totalUnits),
    estimatedTotal: order.estimatedTotal,
    note: order.note,
  };
}
