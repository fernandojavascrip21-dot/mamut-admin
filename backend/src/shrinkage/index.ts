// API pública del módulo de merma simple (T-25): dar de baja piezas de un vendedor o de la bodega.
export * from './shrinkage'
export * from './history'
export type { CreateShrinkageInput, Shrinkage, ShrinkageActor, ShrinkageHistoryFilter, ShrinkageHistoryItem, ShrinkageOption, ShrinkageOptions, ShrinkageReason, ShrinkageReasonOption } from './types'
export { INVALID_REASON, MAX_QTY, SELLER_SHRINKAGE_HISTORY_LIMIT, SHRINKAGE_HISTORY_LIMIT, SHRINKAGE_MISMATCH, SHRINKAGE_REASONS } from './constants'
