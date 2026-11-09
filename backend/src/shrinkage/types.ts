import type { SHRINKAGE_REASONS } from './constants'

// Código de motivo de una merma (spec T-25 §3).
export type ShrinkageReason = keyof typeof SHRINKAGE_REASONS

// Quien registra o consulta una merma; solo el administrador puede.
export interface ShrinkageActor {
  userId: string
  role: string
}

export interface CreateShrinkageInput {
  requestId: string               // UUID en minúsculas
  holderProfileId: string | null  // null = bodega
  productId: number
  qty: number                     // 1..MAX_QTY, en positivo
  reason: string                  // se valida contra SHRINKAGE_REASONS
}

// Lo que ven la pantalla de HU-25 y el resumen. `qty` va en positivo; `stock` es del titular.
export interface Shrinkage {
  requestId: string
  createdAt: string
  qty: number
  reason: ShrinkageReason
  reasonLabel: string
  holder: { id: string; fullName: string } | null // null = bodega
  product: { id: number; name: string; image: string | null }
  stock: { before: number; after: number }
}

// Esqueleto (HU-25): contrato de GET /api/shrinkages/options.
export interface ShrinkageOption {
  productId: number
  name: string
  image: string | null
  units: number // piezas del titular
}

export interface ShrinkageReasonOption {
  code: ShrinkageReason
  label: string
}

export interface ShrinkageOptions {
  holder: { id: string; fullName: string } | null // null = bodega
  products: ShrinkageOption[]
  reasons: ShrinkageReasonOption[]
}
