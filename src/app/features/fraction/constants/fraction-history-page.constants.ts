// Textos de la pantalla «Fraccionados» (HU-24, spec §2 y §5).
export const FRACTION_HISTORY_TEXTS = {
  title: 'Fraccionados',
  subtitle: 'Los 50 fraccionados más recientes',
  searchLabel: 'Buscar fraccionado',
  searchPlaceholder: 'Buscar por nombre del entero o de la bolsita',
  loading: 'Cargando los fraccionados…',
  loadError: 'No pudimos cargar los fraccionados',
  loadErrorHint: 'Revisa tu conexión e inténtalo de nuevo.',
  retry: 'Reintentar',
  empty: 'Todavía no hay fraccionados',
  emptyHint: 'Cuando fraccionas un entero, aquí queda el registro.',
  emptyLink: 'Ir a Stock general',
  noMatch: 'Ningún fraccionado coincide',
  noMatchHint: 'Borra la búsqueda para ver todos.',
  clearSearch: 'Borrar búsqueda',
  countSingular: 'fraccionado',
  countPlural: 'fraccionados',
} as const;

// Destino del enlace «Ir a Stock general» cuando no hay fraccionados. Una feature no importa otra.
export const STOCK_URL = '/admin/stock';
