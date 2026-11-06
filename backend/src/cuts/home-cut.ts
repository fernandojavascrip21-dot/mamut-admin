import { sql } from 'drizzle-orm'
import { db } from '@db/client'
import { forbidden } from '@lib/errors'
import {
  resolveCutHolder, resolveCutPeriod, salesOf,
  type CashCutInput, type CutActor, type CutPeriodKind, type ResolvedPeriod,
} from './cuts'

// Totales del corte para casa (T-22). `factoryCost` es el costo de fábrica guardado en cada venta;
// `realProfit` = total − factoryCost; `shippingCover` = costo con envío − costo de fábrica, los dos
// ya redondeados, así que el `profit` del corte con precios + `shippingCover` = `realProfit`.
export interface HomeCutTotals {
  salesCount: number
  units: number
  total: string
  factoryCost: string
  realProfit: string
  shippingCover: string
}

export interface HomeCutProductLine {
  productId: number
  name: string
  image: string | null
  unitPrice: string
  units: number
  total: string
  factoryCost: string
  realProfit: string
  shippingCover: string
}

export interface HomeCutSaleLine {
  productId: number
  name: string
  qty: number
  unitPrice: string
  subtotal: string
  unitCost: string // costo con envío guardado en la venta
  factoryUnitCost: string
  realProfit: string
}

export interface HomeCutSale {
  requestId: string
  soldAt: string
  registeredByAdmin: boolean
  soldBy: { id: string; fullName: string }
  total: string
  realProfit: string
  shippingCover: string
  lines: HomeCutSaleLine[]
}

export interface HomeCut {
  type: 'home'
  holder: { id: string; fullName: string } | null
  period: { kind: CutPeriodKind; from: string; to: string; timeZone: string }
  totals: HomeCutTotals
  products: HomeCutProductLine[]
  sales: HomeCutSale[]
}

type HomeTotalsRow = {
  sales_count: number
  units: number
  total: string
  factory_cost: string
  real_profit: string
  shipping_cover: string
}

type HomeProductRow = {
  product_id: number
  name: string
  image: string | null
  unit_price: string
  units: number
  total: string
  factory_cost: string
  real_profit: string
  shipping_cover: string
}

// Totales del corte para casa. `total` es exacto (numeric a 2 decimales), igual que en el corte con
// precios. Cada costo (de fábrica y con envío) suma `qty × costo` a 4 decimales y se redondea a
// centavos una sola vez, al final (T-08; con costos ≥ 0 `round` equivale a «mitad hacia arriba»).
// `realProfit` y `shippingCover` son restas de montos ya en centavos, así cuadran al centavo con el
// corte con precios. Un `shippingCover` negativo (costo con envío menor al de fábrica) sale tal cual.
async function queryHomeTotals(holder: { id: string } | null, period: ResolvedPeriod): Promise<HomeCutTotals> {
  const [row] = await db.execute<HomeTotalsRow>(sql`
    select
      t.sales_count, t.units, t.total::text as total, t.factory_cost::text as factory_cost,
      (t.total - t.factory_cost)::text as real_profit,
      (t.cost - t.factory_cost)::text as shipping_cover
    from (
      select
        count(distinct ds.id)::int as sales_count,
        coalesce(sum(dsi.qty), 0)::int as units,
        round(coalesce(sum(dsi.qty * dsi.unit_price), 0), 2) as total,
        round(coalesce(sum(dsi.qty * dsi.unit_cost), 0), 2) as cost,
        round(coalesce(sum(dsi.qty * dsi.factory_unit_cost), 0), 2) as factory_cost
      from direct_sales ds
      join direct_sale_items dsi on dsi.direct_sale_id = ds.id
      where ${salesOf(holder, period)}
    ) t
  `)
  return {
    salesCount: row.sales_count,
    units: row.units,
    total: row.total,
    factoryCost: row.factory_cost,
    realProfit: row.real_profit,
    shippingCover: row.shipping_cover,
  }
}

// Desglose por producto y precio de venta, con la misma agrupación y orden que el corte con precios
// (los renglones coinciden uno a uno, RF-30) y las mismas fórmulas que los totales.
async function queryHomeProducts(holder: { id: string } | null, period: ResolvedPeriod): Promise<HomeCutProductLine[]> {
  const rows = await db.execute<HomeProductRow>(sql`
    select
      g.product_id, g.name, g.image, g.unit_price::text as unit_price, g.units,
      g.total::text as total, g.factory_cost::text as factory_cost,
      (g.total - g.factory_cost)::text as real_profit,
      (g.cost - g.factory_cost)::text as shipping_cover
    from (
      select
        dsi.product_id,
        p.name,
        p.image,
        dsi.unit_price,
        sum(dsi.qty)::int as units,
        round(sum(dsi.qty * dsi.unit_price), 2) as total,
        round(sum(dsi.qty * dsi.unit_cost), 2) as cost,
        round(sum(dsi.qty * dsi.factory_unit_cost), 2) as factory_cost
      from direct_sales ds
      join direct_sale_items dsi on dsi.direct_sale_id = ds.id
      join products p on p.id = dsi.product_id
      where ${salesOf(holder, period)}
      group by dsi.product_id, p.name, p.image, dsi.unit_price
    ) g
    order by g.total desc, g.name, g.unit_price desc
  `)
  return rows.map((row) => ({
    productId: Number(row.product_id),
    name: row.name,
    image: row.image || null, // sin foto la base guarda '' (igual que en T-18)
    unitPrice: row.unit_price,
    units: row.units,
    total: row.total,
    factoryCost: row.factory_cost,
    realProfit: row.real_profit,
    shippingCover: row.shipping_cover,
  }))
}

// Corte para casa de un titular: las mismas ventas, periodo y titular que el corte con precios
// (`salesOf`, `resolveCutPeriod`, `resolveCutHolder`), con el costo de fábrica en lugar del costo
// con envío. Solo el administrador lo ve (RNF-04): el vendedor recibe 403 antes de leer nada,
// aun si pide su propio corte.
export async function getHomeCut(input: CashCutInput, actor: CutActor): Promise<HomeCut> {
  if (actor.role !== 'admin') throw forbidden()
  const period = await resolveCutPeriod(input.period, input.date)
  const holder = await resolveCutHolder(input.holderId, actor)
  const [totals, products] = await Promise.all([
    queryHomeTotals(holder, period),
    queryHomeProducts(holder, period),
  ])
  return {
    type: 'home',
    holder,
    period: { kind: period.kind, from: period.from, to: period.to, timeZone: period.timeZone },
    totals,
    products,
    sales: [],
  }
}
