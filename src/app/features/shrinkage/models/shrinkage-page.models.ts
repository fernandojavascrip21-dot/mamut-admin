// Lo que pinta el pop-up en cada momento: cargando, un error de carga, un vendedor que no existe, sin
// piezas, el formulario o el resultado de la merma registrada.
export type ShrinkagePageState = 'loading' | 'error' | 'not-found' | 'empty' | 'form' | 'result';
