// API pública del módulo de entradas a bodega (HU-27): sumar piezas de un producto existente.
export * from './purchases'
export type { CreatePurchaseInput, Purchase, PurchaseActor } from './types'
export { MAX_QTY, PRODUCT_INACTIVE, PURCHASE_MISMATCH } from './constants'
