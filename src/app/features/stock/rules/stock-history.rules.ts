import { normalizeText } from '@shared/utils/normalize-text';
import type { FractionHistoryItem, ShrinkageHistoryItem } from '../interfaces/stock-history.models';

// Filtra las mermas por el nombre del producto. Ambos lados pasan por normalizeText, así que
// «proteina» encuentra «Proteína»; una búsqueda vacía devuelve todo. Nunca modifica la lista.
export function filterShrinkageHistory(items: ShrinkageHistoryItem[], query: string): ShrinkageHistoryItem[] {
  const needle = normalizeText(query);
  if (needle === '') return [...items];
  return items.filter((item) => normalizeText(item.product.name).includes(needle));
}

// Filtra los fraccionados por el nombre del entero o de la bolsita. Ambos lados pasan por normalizeText,
// así que «proteina» encuentra «Proteína»; una búsqueda vacía devuelve todo. Nunca modifica la lista.
export function filterFractionHistory(items: FractionHistoryItem[], query: string): FractionHistoryItem[] {
  const needle = normalizeText(query);
  if (needle === '') return [...items];
  return items.filter(
    (item) =>
      normalizeText(item.product.name).includes(needle) ||
      normalizeText(item.portionProduct.name).includes(needle),
  );
}
