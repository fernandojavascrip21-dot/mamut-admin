// Textos de la pantalla. Los de los estados cargando, vacío y error son los del canvas
// (tablero `EstadosMiStock`, pantalla 09) y los de «sin resultados» son los de Stock general.
export const MY_STOCK_PAGE_TEXTS = {
  title: 'Mi stock',
  totalLabel: 'Piezas en total',
  searchLabel: 'Buscar producto',
  searchPlaceholder: 'Buscar por nombre',
  loadingTitle: 'Cargando tu stock…',
  loadingHint: 'Un momento.',
  emptyTitle: 'Aún no te han dejado producto',
  emptyHint: 'Cuando el administrador te deje piezas, las verás aquí.',
  errorTitle: 'No pudimos cargar tu stock',
  errorHint: 'Revisa tu conexión e inténtalo de nuevo.',
  retry: 'Reintentar',
  noMatchTitle: 'No hay productos con ese nombre',
  noMatchHint: 'Revisa cómo lo escribiste.',
  clearSearch: 'Limpiar búsqueda',
} as const;
