// Destino de «Ir a vender» y «Seguir vendiendo» (HU-15).
export const SELL_URL = '/vendedor/vender';

// Producto que se muestra cuando un renglón del carrito ya no viene en el stock del vendedor: no hay
// nombre ni precio que leer, así que sale «Agotado» con este texto y sin subtotal.
export const UNAVAILABLE_PRODUCT_NAME = 'Producto no disponible';

// Textos de «Carrito». Los de carrito vacío («Tu carrito está vacío», «Agrega productos desde
// Vender.», «Ir a vender»), «c/u», «de N», «Quitar», «Total» y «Solo te quedan N de este producto» salen
// del canvas (tableros `Venta` vista carrito y `EstadosCarritoVendedor`, pantalla 06b). Cargando y
// error de carga son los de «Vender». «Confirmar venta» no está: llega con HU-16.
export const CART_PAGE_TEXTS = {
  title: 'Carrito',
  loadingTitle: 'Cargando tu stock…',
  loadingHint: 'Un momento.',
  errorTitle: 'No pudimos cargar tu stock',
  errorHint: 'Revisa tu conexión e inténtalo de nuevo.',
  retry: 'Reintentar',
  emptyTitle: 'Tu carrito está vacío',
  emptyHint: 'Agrega productos desde Vender.',
  emptyAction: 'Ir a vender',
  keepSelling: 'Seguir vendiendo',
  total: 'Total',
  each: 'c/u',
  ofStock: 'de',
  remove: 'Quitar',
  decrementPrefix: 'Quitar una pieza de',
  incrementPrefix: 'Agregar una pieza de',
  removePrefix: 'Quitar del carrito',
  soldOut: 'Agotado',
  soldOutHint: 'Ya no te quedan piezas. Quítalo del carrito.',
  onlySingular: 'Solo te queda',
  onlyPlural: 'Solo te quedan',
  onlySuffix: 'de este producto',
  fixHint: 'Baja las piezas o quita lo que ya no tengas para poder vender.',
} as const;
