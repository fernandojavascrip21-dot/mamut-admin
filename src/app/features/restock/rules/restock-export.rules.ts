import type { RestockExportDocument } from '../interfaces/restock-export.models';
import type { RestockOrder } from '../interfaces/restock.models';

// Documento que se escribe en el PDF y en el Excel a partir del pedido guardado.
export function buildExportDocument(order: RestockOrder): RestockExportDocument {
  throw new Error(`Sin implementar: ${order.id}`);
}
