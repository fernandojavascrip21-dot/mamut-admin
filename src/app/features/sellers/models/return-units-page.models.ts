// Estado de la pantalla «Retirar producto»: `empty` es un vendedor sin piezas (no hay nada que
// retirar), `not-found` un 404 (no existe, no es vendedor o está desactivado) y `error` cualquier
// otra falla de carga, que se puede reintentar.
export type ReturnUnitsPageState = 'loading' | 'error' | 'not-found' | 'empty' | 'ready';
