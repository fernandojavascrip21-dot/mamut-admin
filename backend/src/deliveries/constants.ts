// 409 cuando un requestId ya se usó con otro vendedor, producto o cantidad (spec HU-11 §2).
export const DELIVERY_MISMATCH = 'Esta entrega ya se registró con otros datos. Revisa el detalle del vendedor.'

// Entregas que devuelve el historial de un vendedor.
export const HISTORY_LIMIT = 20

// Máximo de un integer de Postgres: más piezas que eso no caben en stock_movements.qty.
export const MAX_QTY = 2_147_483_647
