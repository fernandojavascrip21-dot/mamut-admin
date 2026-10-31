// Estado del resumen de un retiro: `not-found` cubre un 404 (no existe, es de otro vendedor o el
// requestId es de una entrega) y `error` cualquier otra falla de carga, que se puede reintentar.
export type ReturnSummaryPageState = 'loading' | 'error' | 'not-found' | 'ready';
