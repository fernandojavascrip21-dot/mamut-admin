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

type HomeSaleLineRow = {
  sale_id: number
  request_id: string | null
  sold_at: Date | string
  registered_by_admin: boolean
  sold_by_id: string
  sold_by_name: string
  sale_total: string
  sale_real_profit: string
  sale_shipping_cover: string
  product_id: number
  name: string
  qty: number
  unit_price: string
  unit_cost: string
  factory_unit_cost: string
  subtotal: string
  line_real_profit: string
}

// Ventas del periodo con sus renglones, la más reciente primero y en el mismo orden que el corte con
// precios. `realProfit` (de renglón y de venta) sigue la regla de T-18 con el costo de fábrica: exacta
// en diezmilésimas y redondeada a centavos una vez, mitad hacia arriba (`floor(x × 100 + 0.5) / 100`).
// `shippingCover` de la venta es la resta de sus dos costos ya redondeados, igual que en los totales.
// Las sumas por venta pueden diferir en un centavo por venta de los totales; mandan los totales.
async function queryHomeSales(holder: { id: string } | null, period: ResolvedPeriod): Promise<HomeCutSale[]> {
  const rows = await db.execute<HomeSaleLineRow>(sql`
    select
      ds.id as sale_id,
      ds.request_id,
      ds.sold_at,
      (ds.holder_profile_id is not null and ds.sold_by <> ds.holder_profile_id) as registered_by_admin,
      ds.sold_by as sold_by_id,
      seller.full_name as sold_by_name,
      round(sum(dsi.qty * dsi.unit_price) over (partition by ds.id), 2)::text as sale_total,
      round(floor(sum(dsi.qty * (dsi.unit_price - dsi.factory_unit_cost)) over (partition by ds.id) * 100 + 0.5) / 100, 2)::text as sale_real_profit,
      (round(sum(dsi.qty * dsi.unit_cost) over (partition by ds.id), 2)
        - round(sum(dsi.qty * dsi.factory_unit_cost) over (partition by ds.id), 2))::text as sale_shipping_cover,
      dsi.product_id,
      p.name,
      dsi.qty,
      dsi.unit_price::text as unit_price,
      dsi.unit_cost::text as unit_cost,
      dsi.factory_unit_cost::text as factory_unit_cost,
      round(dsi.qty * dsi.unit_price, 2)::text as subtotal,
      round(floor(dsi.qty * (dsi.unit_price - dsi.factory_unit_cost) * 100 + 0.5) / 100, 2)::text as line_real_profit
    from direct_sales ds
    join direct_sale_items dsi on dsi.direct_sale_id = ds.id
    join products p on p.id = dsi.product_id
    join profiles seller on seller.id = ds.sold_by
    where ${salesOf(holder, period)}
    order by ds.sold_at desc, ds.id desc, dsi.id asc
  `)
  const sales = new Map<number, HomeCutSale>()
  for (const row of rows) {
    const saleId = Number(row.sale_id)
    let sale = sales.get(saleId)
    if (!sale) {
      sale = {
        requestId: row.request_id ?? '',
        soldAt: new Date(row.sold_at).toISOString(),
        registeredByAdmin: row.registered_by_admin,
        soldBy: { id: row.sold_by_id, fullName: row.sold_by_name },
        total: row.sale_total,
        realProfit: row.sale_real_profit,
        shippingCover: row.sale_shipping_cover,
        lines: [],
      }
      sales.set(saleId, sale)
    }
    sale.lines.push({
      productId: Number(row.product_id),
      name: row.name,
      qty: row.qty,
      unitPrice: row.unit_price,
      subtotal: row.subtotal,
      unitCost: row.unit_cost,
      factoryUnitCost: row.factory_unit_cost,
      realProfit: row.line_real_profit,
    })
  }
  return [...sales.values()]
}

// Corte para casa de un titular: las mismas ventas, periodo y titular que el corte con precios
// (`salesOf`, `resolveCutPeriod`, `resolveCutHolder`), con el costo de fábrica en lugar del costo
// con envío. Solo el administrador lo ve (RNF-04): el vendedor recibe 403 antes de leer nada,
// aun si pide su propio corte.
export async function getHomeCut(input: CashCutInput, actor: CutActor): Promise<HomeCut> {
  if (actor.role !== 'admin') throw forbidden()
  const period = await resolveCutPeriod(input.period, input.date)
  const holder = await resolveCutHolder(input.holderId, actor)
  const [totals, products, sales] = await Promise.all([
    queryHomeTotals(holder, period),
    queryHomeProducts(holder, period),
    queryHomeSales(holder, period),
  ])
  return {
    type: 'home',
    holder,
    period: { kind: period.kind, from: period.from, to: period.to, timeZone: period.timeZone },
    totals,
    products,
    sales,
  }
}
