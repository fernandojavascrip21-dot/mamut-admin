import type { StockLevel } from '@stock'

// Quien consulta o registra pedidos de resurtir; solo el administrador puede.
export interface RestockActor {
  userId: string
  role: string
}

export type RestockOrderStatus = 'draft' | 'closed'

// Filtro de la lista. `status` llega sin validar: el caso de uso responde 422 si no es un estado.
export interface RestockOrdersFilter {
  status?: string
}

// Una sugerencia: un producto con poca existencia en la bodega. No trae cantidad a pedir.
export interface RestockSuggestion {
  productId: number
  name: string
  image: string | null
  units: number // piezas en bodega
  stockLevel: 'low' | 'out'
  unitCost: string // costo de fábrica actual, «123.4500»
}

// Un producto que se puede pedir (HU-31): todos los activos que no son bolsita, también con 0 piezas.
export interface RestockProduct {
  productId: number
  name: string
  image: string | null
  units: number // piezas en bodega
  stockLevel: StockLevel
  unitCost: string // costo de fábrica actual, «123.4500»
}

// Renglón de catálogo. `unitCost` es el costo del pedido (solo del renglón, no toca products.unit_cost):
// sin valor, un renglón nuevo toma el costo actual del producto y uno guardado conserva el suyo.
export interface RestockCatalogLineInput {
  productId: number
  qty: number
  unitCost?: string | null
}

// Renglón escrito a mano (HU-31): texto del pedido, sin producto. `unitCost` null cuenta 0 en el total.
export interface RestockCustomLineInput {
  name: string
  qty: number
  unitCost: string | null
}

export type RestockLineInput = RestockCatalogLineInput | RestockCustomLineInput

// Renglón ya revisado por el caso de uso: el costo viene normalizado («4.0000») o null.
export type PlannedLine =
  | { kind: 'catalog'; productId: number; qty: number; unitCost: string | null }
  | { kind: 'custom'; name: string; qty: number; unitCost: string | null }

export interface CreateRestockOrderInput {
  requestId: string // UUID en minúsculas
  note: string | null
  lines: RestockLineInput[]
}

export interface UpdateRestockOrderInput {
  note: string | null
  lines: RestockLineInput[]
}

export interface RestockOrderLine {
  product: { id: number; name: string; image: string | null }
  qty: number
  unitCost: string
}

export interface RestockCustomLine {
  id: number
  name: string
  qty: number
  unitCost: string | null
}

export interface RestockOrderSummary {
  id: number
  status: RestockOrderStatus
  note: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  lineCount: number // catálogo y escritos juntos
  totalUnits: number
  estimatedTotal: string // «1234.50»: sum(qty * unit_cost) redondeado a centavos una sola vez
}

export interface RestockOrder extends RestockOrderSummary {
  requestId: string
  lines: RestockOrderLine[] // solo renglones de catálogo
  customLines: RestockCustomLine[] // renglones escritos a mano
}
