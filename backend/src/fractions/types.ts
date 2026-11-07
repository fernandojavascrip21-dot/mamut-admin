import type { fractions, products } from '@db/schema'

export interface CreateFractionInput {
  requestId: string
  productId: number
  portions: number
  price: string | null
  // Porción de la bolsita nueva (texto libre). Ausente o null: se usa la del entero. Con bolsita ya
  // existente se ignora.
  portionSize?: string | null
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
  portionProduct: { id: number; name: string; price: string; active: boolean; portionSize: string } | null
}

// Fila del historial de fraccionados (HU-24): el entero, la bolsita y quién lo hizo.
export interface FractionHistoryItem {
  id: number
  requestId: string
  createdAt: string
  portions: number
  wholeUnitCost: string     // escala 4
  portionUnitCost: string   // escala 4
  portionPrice: string      // escala 2
  product: { id: number; name: string }
  portionProduct: { id: number; name: string }
  createdBy: { id: string; name: string }
}
