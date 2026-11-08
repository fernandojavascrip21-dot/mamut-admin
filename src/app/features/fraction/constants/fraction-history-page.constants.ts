// Textos de la pantalla «Fraccionados» (HU-24, spec §2): solo los que piden los estados y el buscador.
export const FRACTION_HISTORY_TEXTS = {
  title: 'Fraccionados',
  searchLabel: 'Buscar fraccionado',
  loadError: 'No pudimos cargar los fraccionados',
  retry: 'Reintentar',
  empty: 'Todavía no hay fraccionados',
  emptyLink: 'Ir a Stock general',
  noMatch: 'Ningún fraccionado coincide',
  noMatchHint: 'Borra la búsqueda para ver todos.',
  countSingular: 'fraccionado',
  countPlural: 'fraccionados',
} as const;

// Destino del enlace «Ir a Stock general» cuando no hay fraccionados. Una feature no importa otra.
export const STOCK_URL = '/admin/stock';

// Destino del enlace «Ver fraccionados» del pop-up «Fraccionar» (HU-24). Lo usa fraction-page.
export const FRACTION_HISTORY_URL = '/admin/fraccionados';
