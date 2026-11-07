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
