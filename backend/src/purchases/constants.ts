// Máximo de un integer de Postgres: más piezas que eso no caben en stock_movements.qty.
export const MAX_QTY = 2_147_483_647

// 409 cuando el requestId ya se usó con otro producto o piezas, o lo usó otro tipo de movimiento.
export const PURCHASE_MISMATCH = 'Esta entrada ya se registró con otros datos.'

// 409 cuando el producto está desactivado: no recibe piezas nuevas.
export const PRODUCT_INACTIVE = 'El producto está desactivado'
