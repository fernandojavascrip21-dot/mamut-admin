import type { ShrinkageHistoryItem } from '../interfaces/shrinkage.models';

// Filtra el historial por el nombre del producto, sin mayúsculas ni acentos. Esqueleto: aún sin implementar.
export function filterShrinkageHistory(items: ShrinkageHistoryItem[], query: string): ShrinkageHistoryItem[] {
  throw new Error(`no implementado: ${items.length} ${query}`);
}
