import type { ShrinkageHistoryItem } from '../interfaces/shrinkage.models';

// Estado de la carga del historial de mermas: «ready» cubre también la lista vacía.
export type ShrinkageHistoryPageState = 'loading' | 'error' | 'ready';

// Lo último que llegó de la carga: su estado y la lista (vacía mientras carga o si falló).
export interface ShrinkageHistoryLoad {
  state: ShrinkageHistoryPageState;
  items: ShrinkageHistoryItem[];
}
