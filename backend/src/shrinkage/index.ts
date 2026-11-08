// API pública del módulo de merma simple (T-25): dar de baja piezas de un vendedor o de la bodega.
export * from './shrinkage'
export type { CreateShrinkageInput, Shrinkage, ShrinkageActor, ShrinkageReason } from './types'
export { INVALID_REASON, MAX_QTY, SHRINKAGE_MISMATCH, SHRINKAGE_REASONS } from './constants'
