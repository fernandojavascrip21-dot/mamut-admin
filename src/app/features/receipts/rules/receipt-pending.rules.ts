import type { PendingReceiptLines } from '../interfaces/receipt.models';
import type { PendingTab } from '../models/receipt-pending-page.models';

// Apartado con el que se abre la página: productos nuevos, salvo que no haya ninguno y sí haya cambios de costo.
export function initialPendingTab(pending: PendingReceiptLines | undefined): PendingTab {
  if (!pending) return 'new';
  return pending.newProducts.length === 0 && pending.costChanges.length > 0 ? 'cost' : 'new';
}
