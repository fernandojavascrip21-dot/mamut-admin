import type { PendingReceiptLines } from '../interfaces/receipt.models';
import type { PendingTab } from '../models/receipt-pending-page.models';

// Apartado con el que se abre la página: el primero con contenido, en el orden de los botones; si no hay
// ninguno, «Productos nuevos».
export function initialPendingTab(pending: PendingReceiptLines | undefined): PendingTab {
  if (!pending) return 'new';
  if (pending.newProducts.length > 0) return 'new';
  if (pending.costChanges.length > 0) return 'cost';
  return (pending.incompleteProducts ?? []).length > 0 ? 'incomplete' : 'new';
}
