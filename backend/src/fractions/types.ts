import type { fractions, products } from '@db/schema'

export interface CreateFractionInput {
  requestId: string
  productId: number
  portions: number
  price: string | null
}

export interface FractionActor {
  userId: string
  role: string
}

export interface Fraction {
  id: number
  requestId: string
  portions: number
  wholeUnitCost: string
  portionUnitCost: string
  createdAt: string
  product: { id: number; name: string; stock: number }
  portionProduct: { id: number; name: string; created: boolean; price: string; stock: number }
}

// Filas de la base que usa el caso de uso (typeof del esquema de Drizzle).
export type FractionRow = typeof fractions.$inferSelect
export type ProductRow = typeof products.$inferSelect

// Un entero que se puede abrir en bolsitas, con lo que la pantalla de fraccionar necesita (HU-23).
export interface FractionOption {
  productId: number
  name: string
  image: string | null
  warehouseUnits: number
  unitCost: string
  portionSize: string
  portionProduct: { id: number; name: string; price: string; active: boolean } | null
}
