import type { CardPassThrough } from 'primeng/types/card';

// «Fraccionar» (HU-23) abre la pantalla del administrador con el entero ya elegido en `producto`.
// Se repite la ruta aquí porque una feature no importa otra.
export const FRACTION_URL = '/admin/fraccionar';
export const FRACTION_QUERY_PARAM = 'producto';

// El marco es `p-card`; su cuerpo y su contenido se estiran para que el enlace de edición ocupe el
// alto de la tarjeta y «Dejar a vendedor» quede abajo, como antes con `surface-card`.
export const PRODUCT_CARD_PASS_THROUGH = {
  body: { class: 'flex min-h-0 flex-1 flex-col' },
  content: { class: 'flex min-h-0 min-w-0 flex-1 flex-col' },
} satisfies CardPassThrough;

// Textos de «Agregar» en la tarjeta (HU-17): botón, −/+ con nombre accesible por producto y la
// leyenda de piezas dentro del carrito para lectores de pantalla.
export const PRODUCT_CARD_SELL_TEXTS = {
  sell: 'Agregar',
  sellPrefix: 'Agregar',
  sellSuffix: 'al carrito',
  decrementPrefix: 'Quitar una pieza de',
  incrementPrefix: 'Agregar una pieza de',
  unitsInCartSuffix: 'en el carrito',
  quantity: 'Cantidad',
} as const;

// Texto del enlace «Fraccionar» en el pie de la tarjeta (HU-23).
export const PRODUCT_CARD_FRACTION_TEXT = 'Fraccionar';
