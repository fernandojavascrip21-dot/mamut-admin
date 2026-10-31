import { and, asc, eq } from 'drizzle-orm'
import { db } from '@db/client'
import { profiles } from '@db/schema'
import { notFound, validation } from '@lib/errors'
import { stockOfHolder, unitsByHolder, type HolderStockLine } from '@stock'
import { createAccount, toView, type AccountView } from './accounts'
import { PHONE_SEPARATORS, TEN_DIGITS } from './constants'

export type SellerView = AccountView

// Fila de «Mis vendedores» (HU-09): sin correo, para no pedir a Supabase Auth una cuenta por fila.
export interface SellerSummary {
  id: string
  fullName: string
  units: number
}

export type SellerDetail = SellerView & { units: number; stock: HolderStockLine[] }

const isActiveSeller = and(eq(profiles.role, 'vendedor'), eq(profiles.active, true))

// Acepta el teléfono como lo escribe una persona («55 2468 1357», «55-2468-1357»,
// «(55) 2468 1357») y lo deja solo con dígitos, que es lo único que acepta la base (spec T-10).
// «+52» o letras no se limpian: quedan fuera de los 10 dígitos y dan 422. Mismo contrato que
// `normalizePhone` del frontend (`src/app/sellers/rules/seller.rules.ts`).
export function normalizePhone(raw: string): string {
  const digits = raw.replace(PHONE_SEPARATORS, '')
  if (!TEN_DIGITS.test(digits)) throw validation('El teléfono debe tener 10 dígitos')
  return digits
}

// Alta de vendedor (HU-08): misma cuenta en dos pasos que cualquier login (createAccount, con su
// compensación si falla `profiles`), con rol 'vendedor' y teléfono normalizado. El teléfono se
// valida antes de tocar Supabase Auth, para no crear un usuario que luego haya que borrar.
export function createSeller(input: { email: string; password: string; fullName: string; phone: string }): Promise<SellerView> {
  const phone = normalizePhone(input.phone)
  return createAccount(
    { email: input.email, password: input.password, fullName: input.fullName },
    { role: 'vendedor', clientId: null, active: true, phone },
  )
}

// «Mis vendedores» (HU-09): solo vendedores activos, con el total de piezas que tiene cada uno.
export async function listSellers(): Promise<SellerSummary[]> {
  const rows = await db
    .select({ id: profiles.id, fullName: profiles.fullName })
    .from(profiles)
    .where(isActiveSeller)
    .orderBy(asc(profiles.fullName))
  const units = await unitsByHolder(rows.map((row) => row.id))
  return rows.map((row) => ({ ...row, units: units.get(row.id) ?? 0 }))
}

// Detalle de un vendedor (HU-09): sus datos, su total y su stock por producto. Un id que no es de
// un vendedor activo (no existe, es administrador o está desactivado) responde 404, sin distinguir.
export async function getSeller(id: string): Promise<SellerDetail> {
  const [profile] = await db.select().from(profiles).where(and(eq(profiles.id, id), isActiveSeller))
  if (!profile) throw notFound()
  const [view, stock] = await Promise.all([toView(profile), stockOfHolder(id)])
  const units = stock.reduce((total, line) => total + line.units, 0)
  return { ...view, units, stock }
}

// Nombre de un vendedor activo, sin llamar a Supabase Auth (HU-11): las entregas no necesitan su
// correo. Un id que no es de un vendedor activo responde 404, sin distinguir el motivo.
export async function getActiveSellerName(id: string): Promise<{ id: string; fullName: string }> {
  const [profile] = await db
    .select({ id: profiles.id, fullName: profiles.fullName })
    .from(profiles)
    .where(and(eq(profiles.id, id), isActiveSeller))
  if (!profile) throw notFound()
  return profile
}

// Igual, pero también de un vendedor que luego se desactivó: el resumen de una entrega ya hecha no
// debe desaparecer por eso. Solo exige que el perfil sea de un vendedor.
export async function getSellerName(id: string): Promise<{ id: string; fullName: string }> {
  const [profile] = await db
    .select({ id: profiles.id, fullName: profiles.fullName })
    .from(profiles)
    .where(and(eq(profiles.id, id), eq(profiles.role, 'vendedor')))
  if (!profile) throw notFound()
  return profile
}
