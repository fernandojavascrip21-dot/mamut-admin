// Motivos de una merma (spec T-25 §3): código guardado en stock_movements.reason → etiqueta que ve el
// administrador. El orden es el de la lista en pantalla. Deben coincidir con
// stock_movements_shrinkage_reason_check.
export const SHRINKAGE_REASONS = {
  lost: 'Se perdió',
  damaged: 'Dañado',
  expired: 'Caducó',
  other: 'Otro',
} as const

// Máximo de un integer de Postgres: más piezas que eso no caben en stock_movements.qty.
export const MAX_QTY = 2_147_483_647

// 409 cuando el requestId ya se usó con otro titular, producto, piezas o motivo, o lo usó una
// entrega o un retiro.
export const SHRINKAGE_MISMATCH = 'Esta merma ya se registró con otros datos.'

// 422 cuando el motivo falta o no es uno de los cuatro códigos.
export const INVALID_REASON = 'El motivo debe ser lost, damaged, expired u other'

// Cuántas mermas trae GET /api/shrinkages (HU-26): las más recientes.
export const SHRINKAGE_HISTORY_LIMIT = 50

// Cuántas mermas trae GET /api/sellers/[id]/shrinkages, igual que entregas y retiros.
export const SELLER_SHRINKAGE_HISTORY_LIMIT = 20
