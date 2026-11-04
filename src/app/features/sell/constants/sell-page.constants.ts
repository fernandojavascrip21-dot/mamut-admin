// Destino de «Ver carrito» en la barra del catálogo (HU-15).
export const CART_URL = '/vendedor/carrito';

// Textos del catálogo «Vender». Los de cargando, vacío, «+ Agregar», «Agotado» y «Quedan N» salen del
// canvas (tableros `Venta` y `EstadosVender`, pantalla 06); el error de carga es el de «Mi stock»,
// porque el error del canvas («No hay conexión… tu venta todavía no se registró») es de confirmar la
// venta (HU-16); «sin resultados» es el de Stock general y «Mi stock».
export const SELL_PAGE_TEXTS = {
  title: 'Vender',
  searchLabel: 'Buscar producto',
  searchPlaceholder: 'Buscar por nombre',
  loadingTitle: 'Cargando tu stock…',
  loadingHint: 'Un momento.',
  emptyTitle: 'Aún no te han dejado producto',
  emptyHint: 'Pídele al administrador que te deje piezas para vender.',
  errorTitle: 'No pudimos cargar tu stock',
  errorHint: 'Revisa tu conexión e inténtalo de nuevo.',
  retry: 'Reintentar',
  noMatchTitle: 'No hay productos con ese nombre',
  noMatchHint: 'Revisa cómo lo escribiste.',
  clearSearch: 'Limpiar búsqueda',
} as const;

// Textos de la card de producto: «+ Agregar», −/+ con nombre accesible por producto, «Quedan N» (con
// una pieza «Queda 1») y «Agotado» con «Sin piezas».
export const SELL_CARD_TEXTS = {
  add: '+ Agregar',
  soldOut: 'Agotado',
  soldOutLeft: 'Sin piezas',
  leftSingular: 'Queda',
  leftPlural: 'Quedan',
  decrementPrefix: 'Quitar una pieza de',
  incrementPrefix: 'Agregar una pieza de',
  unitsInCartSuffix: 'en el carrito',
} as const;
