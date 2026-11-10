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

export interface RestockLineInput {
  productId: number
  qty: number
}

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

export interface RestockOrderSummary {
  id: number
  status: RestockOrderStatus
  note: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  lineCount: number
  totalUnits: number
}

export interface RestockOrder extends RestockOrderSummary {
  requestId: string
  lines: RestockOrderLine[]
}
