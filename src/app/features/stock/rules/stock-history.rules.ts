import type { ResourceStatus } from '@angular/core';
import { normalizeText } from '@shared/utils/normalize-text';
import { STOCK_VIEW_QUERY } from '../constants/stock-page.constants';
import type { FractionHistoryItem, ShrinkageHistoryItem, StockView } from '../interfaces/stock-history.models';
import type { StockHistoryState } from '../models/stock-page.models';

// Lee el query param `vista` de «Stock general». Sin valor o con uno desconocido cae en «Productos»,
// así que un enlace viejo o escrito a mano nunca deja la pantalla sin lista.
export function stockViewFromQuery(value: string | null): StockView {
  const found = (Object.keys(STOCK_VIEW_QUERY) as StockView[]).find((view) => STOCK_VIEW_QUERY[view] === value);
  return found ?? 'products';
}

// Traduce el estado de un recurso de historial a lo que pinta la pantalla. Un recurso que se recarga
// con datos ya cargados sigue «listo» (no parpadea el esqueleto); «idle» no pinta nada, así que va
// como cargando.
export function historyStateOf(status: ResourceStatus): StockHistoryState {
  if (status === 'error') return 'error';
  return status === 'resolved' || status === 'local' || status === 'reloading' ? 'ready' : 'loading';
}

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
