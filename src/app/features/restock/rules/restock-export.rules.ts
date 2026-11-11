import {
  RESTOCK_CLOSED_LABEL,
  RESTOCK_DRAFT_LABEL,
} from '../constants/restock.constants';
import {
  RESTOCK_EXPORT_FILE_PREFIX,
  RESTOCK_EXPORT_TITLE,
} from '../constants/restock-export.constants';
import type { RestockExportDocument } from '../interfaces/restock-export.models';
import type { RestockOrder } from '../interfaces/restock.models';
import { closedOrSavedAt, formatRestockDate, restockDateStamp } from './restock-dates.rules';

// «N productos · M piezas» con los conteos que manda el backend, sin recalcularlos aquí.
export function restockCountsLabel(lineCount: number, totalUnits: number): string {
  return `${lineCount} productos · ${totalUnits} piezas`;
}

// Documento que se escribe en el PDF y en el Excel a partir del pedido guardado. Nunca lleva costos:
// el archivo lo ve quien compra, no la parte de precios.
export function buildExportDocument(order: RestockOrder): RestockExportDocument {
  const isDraft = order.status === 'draft';
  // Un cerrado se fecha por su cierre; un borrador, por el último guardado.
  const date = isDraft ? order.updatedAt : closedOrSavedAt(order);
  const label = isDraft ? RESTOCK_DRAFT_LABEL : RESTOCK_CLOSED_LABEL;

  return {
    title: RESTOCK_EXPORT_TITLE,
    dateLabel: `${label} ${formatRestockDate(date)}`,
    note: order.note,
    rows: [
      ...order.lines.map((line) => ({ name: line.product.name, qty: line.qty })),
      ...order.customLines.map((line) => ({ name: line.name, qty: line.qty })),
    ],
    totalLabel: restockCountsLabel(order.lineCount, order.totalUnits),
    fileName: `${RESTOCK_EXPORT_FILE_PREFIX}-${order.id}-${restockDateStamp(date)}`,
  };
}
