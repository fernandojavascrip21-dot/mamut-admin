import { normalizeText } from '@shared/utils/normalize-text';
import type { ShrinkageHistoryItem } from '../interfaces/shrinkage.models';

// Filtra el historial por el nombre del producto. Ambos lados pasan por normalizeText, así que
// «proteina» encuentra «Proteína»; una búsqueda vacía devuelve todo. Nunca modifica la lista.
export function filterShrinkageHistory(items: ShrinkageHistoryItem[], query: string): ShrinkageHistoryItem[] {
  const needle = normalizeText(query);
  if (needle === '') return [...items];
  return items.filter((item) => normalizeText(item.product.name).includes(needle));
}
