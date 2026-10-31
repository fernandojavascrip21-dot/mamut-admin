// URL de «Mis vendedores»; el detalle de un vendedor es `${SELLERS_LIST_URL}/<id>`. Las usan las
// páginas que siguen a la barra «Viendo» (HU-10).
export const SELLERS_LIST_URL = '/admin/vendedores';

// Ventana «Dejar a vendedor» de la feature entregas (HU-11). Sellers solo enlaza a su URL, porque
// una feature no importa a otra; los parámetros son `vendedor` y `volver`.
export const DELIVERY_NEW_URL = '/admin/entregas/nueva';
// Resumen de una entrega: `${DELIVERY_URL}/<requestId>`.
export const DELIVERY_URL = '/admin/entregas';
