import { isCheckViolation } from '../db/errors'
import { stockMovements } from '../db/schema'
import type { Tx } from '../db/transaction'
import { conflict } from '../lib/errors'

// Tipos permitidos por stock_movements_type_check.
export type StockMovementType =
  | 'initial' | 'purchase' | 'adjustment' | 'delivery' | 'return'
  | 'direct_sale' | 'direct_sale_void' | 'shrinkage' | 'shrinkage_void'
  | 'fraction_out' | 'fraction_in'

export interface NewStockMovement {
  productId: number
  type: StockMovementType
  qty: number                       // con signo: entrada > 0, salida < 0 (spec T-07 §3)
  holderProfileId: string | null    // null = bodega
  createdBy: string
  reason?: string | null
}

const NOT_ENOUGH_UNITS = 'No hay piezas suficientes'

// Único punto para mover inventario. El trigger de la base ajusta products.stock /
// vendor_stock.qty a partir de cada fila; aquí solo se traduce "saldo negativo" a 409.
// Otros checks (signo inválido para el tipo, qty 0) son bugs del caso de uso y llegan como 500.
export async function insertMovements(tx: Tx, rows: NewStockMovement[]): Promise<void> {
  if (rows.length === 0) return
  try {
    await tx.insert(stockMovements).values(rows.map((row) => ({
      productId: row.productId,
      type: row.type,
      qty: row.qty,
      holderProfileId: row.holderProfileId,
      createdBy: row.createdBy,
      reason: row.reason ?? null,
    })))
  } catch (err) {
    if (isCheckViolation(err, 'products_stock_check') || isCheckViolation(err, 'vendor_stock_qty_check')) {
      throw conflict(NOT_ENOUGH_UNITS)
    }
    throw err
  }
}
