import { normalizeText } from '@shared/utils/normalize-text';
import type { FractionHistoryItem } from '../interfaces/fraction.models';

// Filtra el historial por el nombre del entero o de la bolsita. Ambos lados pasan por normalizeText,
// así que «proteina» encuentra «Proteína»; una búsqueda vacía devuelve todo. Nunca modifica la lista.
export function filterFractionHistory(items: FractionHistoryItem[], query: string): FractionHistoryItem[] {
  const needle = normalizeText(query);
  if (needle === '') return [...items];
  return items.filter((item) =>
    normalizeText(item.product.name).includes(needle) ||
    normalizeText(item.portionProduct.name).includes(needle),
  );
}
