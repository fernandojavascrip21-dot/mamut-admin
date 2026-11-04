// Estado de «Venta confirmada»: cargando, la venta leída, una venta que no existe (404, o 422 por una
// llave que no es UUID) o un error de red con «Reintentar».
export type SaleSummaryState = 'loading' | 'ready' | 'not-found' | 'error';
