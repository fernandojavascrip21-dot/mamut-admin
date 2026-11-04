// API pública del módulo de stock: insertMovements es la única forma de mover inventario;
// holdings solo lee lo que tiene cada vendedor.
export * from './movements'
export * from './holdings'
export * from './levels'
export { LOW_STOCK_THRESHOLD } from './constants'
