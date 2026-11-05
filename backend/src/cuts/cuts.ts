export type CutPeriodKind = 'day' | 'week' | 'month'

export interface CashCutInput {
  holderId: string | null | undefined // null/undefined = bodega (admin) o "yo" (vendedor)
  period: CutPeriodKind
  date: string | undefined // 'YYYY-MM-DD'; undefined = hoy en CUT_TIME_ZONE
}

export interface CutProductLine {
  productId: number
  name: string
  image: string | null
  unitPrice: string
  units: number
  total: string
  cost?: string
  profit?: string
}

export interface CutSaleLine {
  productId: number
  name: string
  qty: number
  unitPrice: string
  subtotal: string
  unitCost?: string
  profit?: string
}

export interface CutSale {
  requestId: string
  soldAt: string
  registeredByAdmin: boolean
  soldBy: { id: string; fullName: string }
  total: string
  profit?: string
  lines: CutSaleLine[]
}

export interface CashCut {
  holder: { id: string; fullName: string } | null
  period: { kind: CutPeriodKind; from: string; to: string; timeZone: string }
  totals: { salesCount: number; units: number; total: string; cost?: string; profit?: string }
  products: CutProductLine[]
  sales: CutSale[]
}
