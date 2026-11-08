// Límites de T-24 repetidos aquí, porque una feature no importa el backend.
export const MIN_PORTIONS = 2;
export const MAX_PORTIONS = 1000;
export const PRICE_MAX = '99999999.99';
export const PRICE_SCALE = 2;

// Etiqueta de la opción deshabilitada y del error del campo producto (spec M5-hu23 §8).
export const NO_UNITS_LABEL = 'Sin piezas en bodega';

// Textos fijos de la página «Fraccionar» (spec M5-hu23 §8).
export const FRACTION_PAGE_TEXTS = {
  title: 'Fraccionar',
  subtitle: 'De la bodega',
  loading: 'Cargando productos…',
  loadError: 'No pudimos cargar los productos',
  retry: 'Reintentar',
  empty: 'No hay productos que se fraccionen',
  emptyLink: 'Ir a Productos',
  saved: 'Fraccionado registrado',
  historyLink: 'Ver fraccionados',
};

// Historial de fraccionados (HU-24): destino del enlace «Ver fraccionados» del pop-up.
export const FRACTION_HISTORY_URL = '/admin/fraccionados';

// Avisos de la página cuando el backend rechaza el fraccionado sin mensaje propio.
export const FRACTION_PAGE_MESSAGES = {
  priceBelowCost: 'El precio queda por debajo del costo de la bolsita',
  portionsInvalid: 'Revisa las bolsitas que salen',
  saveFailed: 'No pudimos registrar el fraccionado. Inténtalo de nuevo.',
};
