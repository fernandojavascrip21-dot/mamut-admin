// Estado del detalle de un vendedor: `not-found` cubre un 404 (no existe, no es vendedor o está
// desactivado) y `error` cualquier otra falla de carga, que se puede reintentar.
export type SellerDetailState = 'loading' | 'error' | 'not-found' | 'ready';
