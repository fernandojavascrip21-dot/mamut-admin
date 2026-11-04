// Mensajes del backend con los que se distinguen los dos 409 de POST /api/sales. Deben ser idénticos
// a NOT_ENOUGH_UNITS (backend/src/stock/constants.ts) y SALE_MISMATCH (backend/src/sales/constants.ts);
// sale-save.service.spec.ts los fija.
export const NOT_ENOUGH_UNITS_MESSAGE = 'No hay piezas suficientes';
export const SALE_MISMATCH_MESSAGE = 'Esta venta ya se registró con otros datos.';

// Pantalla «Venta confirmada»: `${SALE_SUMMARY_URL}/<requestId>`.
export const SALE_SUMMARY_URL = '/vendedor/venta';

// «Venta confirmada» del administrador: `${ADMIN_SALE_SUMMARY_URL}/<requestId>` (HU-17).
export const ADMIN_SALE_SUMMARY_URL = '/admin/venta';

// Parámetro de consulta con el que se abre una venta que ya estaba registrada.
export const REPLAYED_QUERY_PARAM = 'repetida';

// Mensaje de «invalid» cuando el backend no trae uno propio.
export const SALE_INVALID_FALLBACK_MESSAGE = 'No se pudo registrar la venta.';
