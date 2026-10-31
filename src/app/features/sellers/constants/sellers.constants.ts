// URL de «Mis vendedores»; el detalle de un vendedor es `${SELLERS_LIST_URL}/<id>`. Las usan las
// páginas que siguen a la barra «Viendo» (HU-10).
export const SELLERS_LIST_URL = '/admin/vendedores';

// Ventana «Dejar a vendedor» de la feature entregas (HU-11). Sellers solo enlaza a su URL, porque
// una feature no importa a otra; los parámetros son `vendedor` y `volver`.
export const DELIVERY_NEW_URL = '/admin/entregas/nueva';
// Resumen de una entrega: `${DELIVERY_URL}/<requestId>`.
export const DELIVERY_URL = '/admin/entregas';

// Texto del backend cuando el vendedor no tiene tantas piezas (409 de insertMovements). Una feature
// no importa a otra, así que no se reusa la de `deliveries`.
export const NOT_ENOUGH_UNITS_MESSAGE = 'No hay piezas suficientes';

// Máximo de un integer de Postgres: más piezas que eso no caben en stock_movements.qty.
export const MAX_RETURN_QTY = 2_147_483_647;

// Mensajes de campo de «Retirar producto» (HU-12). Salen al confirmar, no al tocar el campo.
export const RETURN_FIELD_MESSAGES = {
  product: 'Elige un producto',
  qty: 'Escribe un número entero mayor a 0',
  maxUnits: NOT_ENOUGH_UNITS_MESSAGE,
} as const;

// Avisos cuando el retiro no se registra.
export const RETURN_FAILURE_MESSAGES = {
  'not-enough-units': NOT_ENOUGH_UNITS_MESSAGE,
  mismatch: 'Este retiro ya se registró con otros datos. Revisa el detalle del vendedor.',
  'not-found': 'Este vendedor o producto ya no está disponible',
  invalid: 'Revisa los datos del retiro.',
  offline: 'No pudimos registrar el retiro',
} as const;
