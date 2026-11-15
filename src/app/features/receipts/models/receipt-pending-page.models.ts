import type { PendingReceiptLines } from '../interfaces/receipt.models';

// Apartado de la página de pendientes: productos nuevos, cambios de costo, o por completar (sin piezas leídas).
export type PendingTab = 'new' | 'cost' | 'incomplete';

// Estado de la carga de la página: esperando la respuesta, lista lista, o fallida.
export type PendingLoad =
  | { status: 'loading' }
  | { status: 'ready'; value: PendingReceiptLines }
  | { status: 'error' };

export interface PendingTabOption {
  label: string;
  value: PendingTab;
}
