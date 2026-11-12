// API pública del módulo de productos.
export * from './products'
export * from './photos'
// Mensaje de HU-04 que reusa el fraccionado al validar el precio de la bolsita (T-24), y el de nombre
// duplicado que reusa el alta desde una remisión (T-41).
export { DUPLICATE_NAME, PRICE_BELOW_COST } from './constants'
