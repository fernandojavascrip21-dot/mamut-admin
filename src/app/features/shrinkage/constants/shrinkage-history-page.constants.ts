// Textos de «Mermas» (HU-26, /admin/mermas).
export const SHRINKAGE_HISTORY_TEXTS = {
  title: 'Mermas',
  titlePrefix: 'Mermas de',
  backToStock: 'Stock general',
  searchLabel: 'Buscar merma',
  loadError: 'No pudimos cargar las mermas',
  retry: 'Reintentar',
  empty: 'Aún no hay mermas',
  emptySellerSuffix: 'no tiene mermas',
  emptyLink: 'Ir a Stock general',
  noMatch: 'No hay mermas de ese producto',
  clearSearch: 'Limpiar búsqueda',
  countSingular: 'merma',
  countPlural: 'mermas',
} as const;

// Destino del enlace «‹ Stock general» y de «Ir a Stock general». Una feature no importa otra.
export const SHRINKAGE_HISTORY_STOCK_URL = '/admin/stock';
