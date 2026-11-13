import type { PendingReceiptLines } from '../interfaces/receipt.models';

// Apartado de la página de pendientes: productos nuevos o cambios de costo.
export type PendingTab = 'new' | 'cost';

// Estado de la carga de la página: esperando la respuesta, lista lista, o fallida.
export type PendingLoad =
  | { status: 'loading' }
  | { status: 'ready'; value: PendingReceiptLines }
  | { status: 'error' };

export interface PendingTabOption {
  label: string;
  value: PendingTab;
}
