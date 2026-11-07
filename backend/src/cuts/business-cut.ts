import { sql } from 'drizzle-orm'
import { db } from '@db/client'
import { forbidden, validation } from '@lib/errors'
import { resolveCutPeriod, salesInPeriod, type CutActor, type CutPeriodKind } from './cuts'
import type { HomeCut, HomeCutTotals } from './home-cut'
import { CUT_SCOPES, INVALID_CUT_SCOPE } from './constants'

export type CutScope = 'holder' | 'business'

// Cifras de un titular con ventas en el periodo; `holder` null = bodega. `active` permite marcar a un
// vendedor desactivado, cuyas ventas siguen contando. Es un alias (no una interface) con los campos de
// `HomeCutTotals`, para que sea asignable a `Record<string, unknown>` (los tests comparan cifras por llave).
export type BusinessCutHolder = {
  holder: { id: string; fullName: string; active: boolean } | null
  salesCount: number
  units: number
  total: string
  factoryCost: string
  realProfit: string
  shippingCover: string
}

export interface BusinessCut {
  type: 'home'
  scope: 'business'
  holder: null
  period: HomeCut['period']
  totals: HomeCutTotals
  holders: BusinessCutHolder[]
}

// `scope` debe ser holder o business; cualquier otro valor es un 422 y no llega a la base.
export function parseCutScope(scope: string): CutScope {
  if (!(CUT_SCOPES as readonly string[]).includes(scope)) throw validation(INVALID_CUT_SCOPE)
  return scope as CutScope
}

type BusinessRow = {
  holder_id: string | null
  full_name: string | null
  active: boolean | null
  sales_count: number
  units: number
  total: string
  factory_cost: string
  real_profit: string
  shipping_cover: string
  is_total: boolean
  position: number
}

const toTotals = (row: BusinessRow): HomeCutTotals => ({
  salesCount: row.sales_count,
  units: row.units,
  total: row.total,
  factoryCost: row.factory_cost,
  realProfit: row.real_profit,
  shippingCover: row.shipping_cover,
})

// Resumen de todo el negocio (HU-22): bodega y vendedores, activos o no. Cada titular usa las mismas
// expresiones de redondeo que `queryHomeTotals`, así su renglón es idéntico a su corte para casa; los
// totales son `sum()` de esas cifras ya redondeadas (no un redondeo aparte), así los renglones siempre
// suman el total al centavo. Solo el administrador: otro rol recibe 403 antes de leer nada.
export async function getBusinessCut(
  input: { period: CutPeriodKind; date?: string },
  actor: CutActor,
): Promise<BusinessCut> {
  if (actor.role !== 'admin') throw forbidden()
  const period = await resolveCutPeriod(input.period, input.date)

  // Una sola consulta (una sola lectura): la fila `is_total` son los totales, sum() de las cifras ya
  // redondeadas por titular; con cero titulares sale en ceros.
  const rows = await db.execute<BusinessRow>(sql`
    with per_holder as (
      select
        ds.holder_profile_id,
        count(distinct ds.id)::int as sales_count,
        coalesce(sum(dsi.qty), 0)::int as units,
        round(coalesce(sum(dsi.qty * dsi.unit_price), 0), 2) as total,
        round(coalesce(sum(dsi.qty * dsi.unit_cost), 0), 2) as cost,
        round(coalesce(sum(dsi.qty * dsi.factory_unit_cost), 0), 2) as factory_cost
      from direct_sales ds
      join direct_sale_items dsi on dsi.direct_sale_id = ds.id
      where ${salesInPeriod(period)}
      group by ds.holder_profile_id
    ),
    holders as (
      select
        h.holder_profile_id as holder_id, pr.full_name, pr.active,
        h.sales_count, h.units, h.total::text as total, h.factory_cost::text as factory_cost,
        (h.total - h.factory_cost)::text as real_profit,
        (h.cost - h.factory_cost)::text as shipping_cover,
        false as is_total,
        row_number() over (order by h.holder_profile_id is null desc, h.total desc, pr.full_name asc) as position
      from per_holder h
      left join profiles pr on pr.id = h.holder_profile_id
    )
    select * from holders
    union all
    select
      null, null, null,
      coalesce(sum(sales_count), 0)::int, coalesce(sum(units), 0)::int,
      round(coalesce(sum(total), 0), 2)::text,
      round(coalesce(sum(factory_cost), 0), 2)::text,
      round(coalesce(sum(total - factory_cost), 0), 2)::text,
      round(coalesce(sum(cost - factory_cost), 0), 2)::text,
      true, 0
    from per_holder
    order by is_total desc, position
  `)
  const [sums, ...holderRows] = rows

  return {
    type: 'home',
    scope: 'business',
    holder: null,
    period: { kind: period.kind, from: period.from, to: period.to, timeZone: period.timeZone },
    totals: toTotals(sums),
    holders: holderRows.map((row) => ({
      holder: row.holder_id ? { id: row.holder_id, fullName: row.full_name ?? '', active: row.active ?? false } : null,
      ...toTotals(row),
    })),
  }
}
