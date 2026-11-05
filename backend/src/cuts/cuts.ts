import { sql } from 'drizzle-orm'
import { db } from '@db/client'
import { getSellerName } from '@accounts'
import { forbidden, validation } from '@lib/errors'
import { CUT_PERIODS, CUT_TIME_ZONE, INVALID_DATE, INVALID_PERIOD, ISO_DATE } from './constants'

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

// Periodo ya resuelto: días locales (inclusive) para mostrar e instantes [startsAt, endsAt) para filtrar.
export interface ResolvedPeriod {
  kind: CutPeriodKind
  from: string // 'YYYY-MM-DD', primer día local
  to: string // 'YYYY-MM-DD', último día local
  timeZone: string
  startsAt: string // instante ISO de from 00:00 local
  endsAt: string // instante ISO de to+1 00:00 local (exclusivo)
}

// `period` debe ser uno de los tres; cualquier otro valor es un 422 y no llega a la base.
export function parseCutPeriod(period: string): CutPeriodKind {
  if (!(CUT_PERIODS as readonly string[]).includes(period)) throw validation(INVALID_PERIOD)
  return period as CutPeriodKind
}

// Formato YYYY-MM-DD *y* fecha real: 2026-02-30 pasa la expresión regular pero Date la desplaza
// de mes, así que se compara de ida y vuelta. Se valida en JS para dar 422 y no un error de Postgres.
function assertRealDate(date: string): void {
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  const real =
    ISO_DATE.test(date) &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  if (!real) throw validation(INVALID_DATE)
}

// Calcula el periodo calendario que contiene `date` (o hoy en México si falta). Todo el cálculo
// de días e instantes se hace en SQL con la zona de México: la hora local de Node nunca interviene,
// así que el resultado no depende de dónde corra el servidor. La semana empieza en lunes
// (`date_trunc('week')`) y el fin es exclusivo (medianoche del día siguiente al último).
export async function resolveCutPeriod(period: string, date: string | undefined): Promise<ResolvedPeriod> {
  const kind = parseCutPeriod(period)
  if (date !== undefined) assertRealDate(date)

  const reference = date === undefined
    ? sql`(now() AT TIME ZONE ${CUT_TIME_ZONE})::date`
    : sql`${date}::date`
  const start = sql`date_trunc(${kind}, ${reference}::timestamp)::date`

  const rows = await db.execute<{ from: string; to: string; starts_at: Date; ends_at: Date }>(sql`
    select
      to_char(p.first_day, 'YYYY-MM-DD') as "from",
      to_char(p.last_day, 'YYYY-MM-DD') as "to",
      p.first_day::timestamp at time zone ${CUT_TIME_ZONE} as starts_at,
      (p.last_day + 1)::timestamp at time zone ${CUT_TIME_ZONE} as ends_at
    from (
      select
        ${start} as first_day,
        case ${kind}
          when 'day' then ${start}
          when 'week' then ${start} + 6
          else (${start} + interval '1 month' - interval '1 day')::date
        end as last_day
    ) p
  `)
  const row = rows[0]
  return {
    kind,
    from: row.from,
    to: row.to,
    timeZone: CUT_TIME_ZONE,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
  }
}

// Quien pide el corte. `role` es el de AuthContext; aquí solo importa si es administrador.
export interface CutActor {
  userId: string
  role: string
}

// Titular del corte según quien lo pide. Un vendedor solo ve el suyo (sin holderId o con el propio;
// otro es 403). El administrador ve la bodega (sin holderId, `null`) o el de cualquier vendedor,
// activo o no: sus ventas son historial. `getSellerName` da 404 si el id no es de un vendedor.
export async function resolveCutHolder(
  holderId: string | null | undefined,
  actor: CutActor,
): Promise<{ id: string; fullName: string } | null> {
  if (actor.role === 'admin') return holderId ? getSellerName(holderId) : null
  if (holderId && holderId !== actor.userId) throw forbidden()
  return getSellerName(actor.userId)
}

// Ventas vigentes del titular dentro del periodo: `null` = bodega. El rango es [inicio, fin) en
// instantes, así que una venta a las 00:00:00 del día siguiente queda fuera. Las anuladas no cuentan.
const salesOf = (holder: { id: string } | null, period: ResolvedPeriod) => sql`
  ${holder ? sql`ds.holder_profile_id = ${holder.id}::uuid` : sql`ds.holder_profile_id is null`}
  and ds.voided_at is null
  and ds.sold_at >= ${period.startsAt}::timestamptz
  and ds.sold_at < ${period.endsAt}::timestamptz`

type TotalsRow = {
  sales_count: number
  units: number
  total: string
  cost: string
  profit: string
}

type ProductRow = {
  product_id: number
  name: string
  image: string | null
  unit_price: string
  units: number
  total: string
  cost: string
  profit: string
}

// Totales del corte. `total` es exacto (numeric a 2 decimales); `cost` suma `qty × unit_cost` a 4
// decimales y se redondea a centavos una sola vez, aquí al final (T-08); `round` de Postgres es
// «mitad lejos de cero», que con costos ≥ 0 equivale a «mitad hacia arriba». `profit` ya sale de
// centavos menos centavos. En un periodo vacío todo queda en cero.
async function queryTotals(holder: { id: string } | null, period: ResolvedPeriod): Promise<CashCut['totals']> {
  const [row] = await db.execute<TotalsRow>(sql`
    select
      count(distinct ds.id)::int as sales_count,
      coalesce(sum(dsi.qty), 0)::int as units,
      round(coalesce(sum(dsi.qty * dsi.unit_price), 0), 2)::text as total,
      round(coalesce(sum(dsi.qty * dsi.unit_cost), 0), 2)::text as cost,
      (round(coalesce(sum(dsi.qty * dsi.unit_price), 0), 2)
        - round(coalesce(sum(dsi.qty * dsi.unit_cost), 0), 2))::text as profit
    from direct_sales ds
    join direct_sale_items dsi on dsi.direct_sale_id = ds.id
    where ${salesOf(holder, period)}
  `)
  return { salesCount: row.sales_count, units: row.units, total: row.total, cost: row.cost, profit: row.profit }
}

// Desglose por producto *y precio de venta*: si el precio cambió dentro del periodo salen dos
// renglones en vez de promediarlo. Nombre y foto son los actuales; precio y costo, los de la venta.
async function queryProducts(holder: { id: string } | null, period: ResolvedPeriod): Promise<CutProductLine[]> {
  const rows = await db.execute<ProductRow>(sql`
    select
      dsi.product_id,
      p.name,
      p.image,
      dsi.unit_price::text as unit_price,
      sum(dsi.qty)::int as units,
      round(sum(dsi.qty * dsi.unit_price), 2)::text as total,
      round(sum(dsi.qty * dsi.unit_cost), 2)::text as cost,
      (round(sum(dsi.qty * dsi.unit_price), 2) - round(sum(dsi.qty * dsi.unit_cost), 2))::text as profit
    from direct_sales ds
    join direct_sale_items dsi on dsi.direct_sale_id = ds.id
    join products p on p.id = dsi.product_id
    where ${salesOf(holder, period)}
    group by dsi.product_id, p.name, p.image, dsi.unit_price
    order by sum(dsi.qty * dsi.unit_price) desc, p.name, dsi.unit_price desc
  `)
  return rows.map((row) => ({
    productId: Number(row.product_id),
    name: row.name,
    image: row.image || null, // sin foto la base guarda '' (igual que en T-18)
    unitPrice: row.unit_price,
    units: row.units,
    total: row.total,
    cost: row.cost,
    profit: row.profit,
  }))
}

// Quita costo y ganancia de la respuesta cuando quien pide no es administrador (RF-02, RNF-04):
// es el único lugar donde se recorta, para que ninguna consulta nueva filtre el costo por olvido.
function trimForRole(cut: CashCut, actor: CutActor): CashCut {
  if (actor.role === 'admin') return cut
  const { cost: _totalCost, profit: _totalProfit, ...totals } = cut.totals
  return {
    ...cut,
    totals,
    products: cut.products.map(({ cost: _cost, profit: _profit, ...product }) => product),
    sales: cut.sales.map(({ profit: _profit, lines, ...sale }) => ({
      ...sale,
      lines: lines.map(({ unitCost: _unitCost, profit: _lineProfit, ...line }) => line),
    })),
  }
}

// Corte de un titular para un periodo calendario, calculado cada vez a partir de las ventas (no se
// guarda). Resuelve primero periodo y titular, para que un 422/403/404 salga sin tocar las ventas.
// La lista de ventas se agrega en el paso siguiente del plan (T-20 §5.5).
export async function getCashCut(input: CashCutInput, actor: CutActor): Promise<CashCut> {
  const period = await resolveCutPeriod(input.period, input.date)
  const holder = await resolveCutHolder(input.holderId, actor)
  const [totals, products] = await Promise.all([queryTotals(holder, period), queryProducts(holder, period)])
  return trimForRole(
    {
      holder,
      period: { kind: period.kind, from: period.from, to: period.to, timeZone: period.timeZone },
      totals,
      products,
      sales: [],
    },
    actor,
  )
}
