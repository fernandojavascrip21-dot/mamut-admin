// Renglones por venta: sobra para un carrito real y acota la transacción (spec T-18 §9).
export const MAX_LINES = 50

// Piezas por renglón. Acotado para que `qty × precio` quepa en los montos de la base.
export const MAX_QTY = 1_000_000

// 409 cuando un requestId ya se usó con otro titular, otros renglones u otra cuenta.
export const SALE_MISMATCH = 'Esta venta ya se registró con otros datos.'

// 422 cuando la venta repite un producto (el carrito ya junta las piezas por producto).
export const DUPLICATE_PRODUCT = 'Un producto aparece dos veces en la venta'
