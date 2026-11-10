// Quien registra o consulta una entrada; solo el administrador puede.
export interface PurchaseActor {
  userId: string
  role: string
}

export interface CreatePurchaseInput {
  requestId: string // UUID en minúsculas
  productId: number
  qty: number // 1..MAX_QTY, en positivo
}

// Lo que ve la pantalla de HU-27. `stock` es el de la bodega antes → después.
export interface Purchase {
  requestId: string
  createdAt: string
  qty: number
  product: { id: number; name: string; image: string | null }
  stock: { before: number; after: number }
}
