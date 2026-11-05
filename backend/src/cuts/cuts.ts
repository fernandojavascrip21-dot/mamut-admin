import { sql } from 'drizzle-orm'
import { db } from '@db/client'
import { validation } from '@lib/errors'
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
