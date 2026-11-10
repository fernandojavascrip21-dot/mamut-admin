// Lo que pinta el pop-up en cada momento: cargando, un error de carga, sin productos activos, el
// formulario o el resultado de la entrada registrada.
export type PurchasePageState = 'loading' | 'error' | 'empty' | 'form' | 'result';
