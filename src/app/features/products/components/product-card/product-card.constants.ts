import type { CardPassThrough } from 'primeng/types/card';

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

// Etiqueta de fraccionado (HU-24): solo la bolsita (producto creado al fraccionar) lleva «Fraccionado»;
// el entero, aunque tenga `fractionable`, no lleva ninguna.
export const PRODUCT_CARD_FRACTION_TAGS = {
  portion: 'Fraccionado',
} as const;

// Rótulo del costo de fábrica de la bolsita, solo con «Yo · bodega» (HU-24).
export const PRODUCT_CARD_COST_TEXT = 'Costo';
