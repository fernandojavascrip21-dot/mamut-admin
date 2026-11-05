// 409 cuando un movimiento dejaría un saldo negativo (spec T-07).
export const NOT_ENOUGH_UNITS = 'No hay piezas suficientes'

// «Baja existencia» (HU-18): un titular (bodega o vendedor) con 1 a este número de piezas. Con 0 es
// «agotado». Es el único lugar donde vive el número: el frontend pinta el `stockLevel` que recibe.
export const LOW_STOCK_THRESHOLD = 2
