import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { revokeSessions } from '@auth'
import { db } from '@db/client'
import { isForeignKeyViolation } from '@db/errors'
import { profiles, stockMovements, vendorStock } from '@db/schema'
import { lockRows, withTransaction } from '@db/transaction'
import { conflict, notFound, validation } from '@lib/errors'
import { sendSellerPasswordEmail, sendSellerStatusEmail, type EmailStatus } from '@notifications'
import { supabaseAdmin } from '@lib/supabase'
import { stockOfHolder, unitsByHolder, type HolderStockLine } from '@stock'
import { createAccount, normalizeEmail, toView, validatePassword, type AccountView } from './accounts'
import {
  ARCHIVED_EMAIL_DOMAIN,
  MAX_BUSINESS_NAME,
  PHONE_SEPARATORS,
  SELLER_HAS_UNITS,
  SELLER_HISTORY_APPEARED,
  SELLER_STATUS_INVALID,
  TEN_DIGITS,
} from './constants'

export type SellerView = AccountView & { businessName: string | null }

// Vista del vendedor tras desactivar o reactivar, con cómo salió el aviso (null = el estado ya era ese).
export type SellerStatusChange = SellerView & { emailStatus: EmailStatus | null }

// Fila de «Mis vendedores» (HU-09): sin correo, para no pedir a Supabase Auth una cuenta por fila.
export interface SellerSummary {
  id: string
  fullName: string
  businessName: string | null
  units: number
}

export type SellerDetail = SellerView & { units: number; stock: HolderStockLine[] }

// Estado que pide la lista (`?status=`): solo activos o solo desactivados.
export type SellerStatus = 'active' | 'inactive'

// Un archivado (spec M13-hu45 §10) no existe para la app: queda fuera de todo lo que lee vendedores.
const isSeller = and(eq(profiles.role, 'vendedor'), isNull(profiles.archivedAt))
const isActiveSeller = and(isSeller, eq(profiles.active, true))

// Acepta el teléfono como lo escribe una persona («55 2468 1357», «55-2468-1357»,
// «(55) 2468 1357») y lo deja solo con dígitos, que es lo único que acepta la base (spec T-10).
// «+52» o letras no se limpian: quedan fuera de los 10 dígitos y dan 422. Mismo contrato que
// `normalizePhone` del frontend (`src/app/sellers/rules/seller.rules.ts`).
export function normalizePhone(raw: string): string {
  const digits = raw.replace(PHONE_SEPARATORS, '')
  if (!TEN_DIGITS.test(digits)) throw validation('El teléfono debe tener 10 dígitos')
  return digits
}

// Nombre del negocio (spec M13-t42): opcional. Se recorta; ausente, null o vacío es «sin negocio».
// Se cuenta en caracteres (no en unidades UTF-16) para coincidir con `char_length` de la base.
export function normalizeBusinessName(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'string') throw validation('El nombre del negocio debe ser texto')
  const trimmed = raw.trim()
  if (trimmed === '') return null
  if ([...trimmed].length > MAX_BUSINESS_NAME) {
    throw validation(`El nombre del negocio debe tener como máximo ${MAX_BUSINESS_NAME} caracteres`)
  }
  return trimmed
}

// Alta de vendedor (HU-08): misma cuenta en dos pasos que cualquier login (createAccount, con su
// compensación si falla `profiles`), con rol 'vendedor' y teléfono normalizado. El teléfono y el
// negocio se validan antes de tocar Supabase Auth, para no crear un usuario que luego haya que borrar.
export async function createSeller(input: {
  email: string
  password: string
  fullName: string
  phone: string
  businessName?: unknown
}): Promise<SellerView> {
  const phone = normalizePhone(input.phone)
  const businessName = normalizeBusinessName(input.businessName)
  const view = await createAccount(
    { email: input.email, password: input.password, fullName: input.fullName },
    { role: 'vendedor', clientId: null, active: true, phone, businessName },
  )
  return { ...view, businessName }
}

// `?status=` de la lista: ausente = activos (HU-09). Solo se aceptan active e inactive; cualquier
// otro valor es un error de forma (422), no un filtro vacío.
export function parseListStatus(raw: string | null): SellerStatus {
  if (raw === null || raw === 'active') return 'active'
  if (raw === 'inactive') return 'inactive'
  throw validation(SELLER_STATUS_INVALID)
}

// `?status=` del detalle: ausente o active = solo activos (un desactivado da 404); any = también
// desactivados, para poder abrir a un vendedor que ya no está activo.
export function parseDetailIncludesInactive(raw: string | null): boolean {
  if (raw === null || raw === 'active') return false
  if (raw === 'any') return true
  throw validation(SELLER_STATUS_INVALID)
}

// Vista de vendedor: la de cuenta más el negocio, que vive en `profiles`.
async function sellerView(profile: typeof profiles.$inferSelect): Promise<SellerView> {
  return { ...(await toView(profile)), businessName: profile.businessName }
}

// «Mis vendedores» (HU-09): vendedores según su estado, con el total de piezas que tiene cada uno.
// Sin `status` va por activos, como hasta ahora (lo usa también el resumen de inventario).
export async function listSellers(status: SellerStatus = 'active'): Promise<SellerSummary[]> {
  const rows = await db
    .select({ id: profiles.id, fullName: profiles.fullName, businessName: profiles.businessName })
    .from(profiles)
    .where(and(isSeller, eq(profiles.active, status === 'active')))
    .orderBy(asc(profiles.fullName))
  const units = await unitsByHolder(rows.map((row) => row.id))
  return rows.map((row) => ({ ...row, units: units.get(row.id) ?? 0 }))
}

// Detalle de un vendedor (HU-09): sus datos, su total y su stock por producto. Por omisión un id
// que no es de un vendedor activo (no existe, es administrador o está desactivado) responde 404,
// sin distinguir. Con `includeInactive` también abre a un desactivado (`?status=any`).
export async function getSeller(
  id: string,
  opts: { includeInactive: boolean } = { includeInactive: false },
): Promise<SellerDetail> {
  const scope = opts.includeInactive ? isSeller : isActiveSeller
  const [profile] = await db.select().from(profiles).where(and(eq(profiles.id, id), scope))
  if (!profile) throw notFound()
  const [view, stock] = await Promise.all([sellerView(profile), stockOfHolder(id)])
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
// debe desaparecer por eso. Exige que el perfil sea de un vendedor y no esté archivado (spec M13-hu45
// §10): a un archivado ningún camino lo alcanza, porque no se puede archivar con piezas y las listas
// ya no lo muestran.
export async function getSellerName(id: string): Promise<{ id: string; fullName: string }> {
  const [profile] = await db
    .select({ id: profiles.id, fullName: profiles.fullName })
    .from(profiles)
    .where(and(eq(profiles.id, id), isSeller))
  if (!profile) throw notFound()
  return profile
}

type Profile = typeof profiles.$inferSelect

export interface UpdateSellerInput {
  fullName: string
  businessName?: unknown
  phone: string
  email: string
}

// Vendedor de cualquier estado, o 404. Un administrador, un UUID inexistente y un id de otro tipo
// responden igual: no se dice cuál de los tres fue.
async function findSeller(id: string): Promise<Profile> {
  const [profile] = await db.select().from(profiles).where(and(eq(profiles.id, id), isSeller))
  if (!profile) throw notFound()
  return profile
}

// Mismo criterio que createAccount: Supabase Auth responde `email_exists` si el correo ya lo usa otra cuenta.
function isEmailTaken(error: { code?: string; message: string }): boolean {
  return error.code === 'email_exists' || /already.*regist/i.test(error.message)
}

// Al CAMBIAR el correo, Supabase Auth responde 500 («Error updating user») en vez de 422 si otra cuenta
// ya lo usa; por eso se mira en auth.users antes de tocar Auth, para dar el 409 de la regla.
async function emailUsedByOther(email: string, id: string): Promise<boolean> {
  const rows = await db.execute(
    sql`select id from auth.users where lower(email) = ${email} and id <> ${id} limit 1`,
  )
  return rows.length > 0
}

// Editar a un vendedor, activo o no (spec M13-t42). El correo es su usuario de Auth: si cambia, se
// cambia primero en Auth sin correo de confirmación y, si luego falla `profiles`, se regresa el
// anterior. Todo se valida antes de tocar Auth o la base, para no dejar un correo cambiado a medias.
export async function updateSeller(id: string, input: UpdateSellerInput): Promise<SellerView> {
  const fullName = input.fullName.trim()
  if (fullName === '') throw validation('El nombre es obligatorio')
  const businessName = normalizeBusinessName(input.businessName)
  const phone = normalizePhone(input.phone)
  const email = normalizeEmail(input.email)
  await findSeller(id)

  const admin = supabaseAdmin()
  // Si Auth no responde, se aborta antes de tocar nada: sin el correo actual no se sabe si hay que compensar.
  const { data, error: readError } = await admin.auth.admin.getUserById(id)
  if (readError) throw readError
  const currentEmail = data.user?.email ?? null
  const emailChanged = email !== currentEmail
  if (emailChanged) {
    if (await emailUsedByOther(email, id)) throw conflict('Ya existe un acceso con ese correo')
    const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true })
    if (error) {
      if (isEmailTaken(error)) throw conflict('Ya existe un acceso con ese correo')
      throw error
    }
  }

  // `returning()` da la fila ya guardada: así la lectura posterior no puede fallar en `profiles`
  // y disparar una compensación de un correo que sí se guardó.
  let saved: typeof profiles.$inferSelect
  try {
    const [row] = await db
      .update(profiles)
      .set({ fullName, businessName, phone })
      .where(eq(profiles.id, id))
      .returning()
    saved = row!
  } catch (err) {
    // Compensación: sin ella el correo nuevo quedaría en Auth con los datos viejos en `profiles`.
    // Si la compensación también falla, se responde el error original (el de `profiles`), que es la
    // causa; el desfase queda visible en la ficha y se corrige reeditando el correo. No se loguean datos.
    if (emailChanged && currentEmail !== null) {
      await admin.auth.admin.updateUserById(id, { email: currentEmail, email_confirm: true })
    }
    throw err
  }
  return sellerView(saved)
}

// Desactivar a un vendedor (spec M13-t42). Con piezas a su cargo no se desactiva: el inventario no
// debe quedar en manos de alguien sin acceso. El candado sobre su perfil y sus filas de vendor_stock
// impide que una entrega se cuele entre la lectura del saldo y el cambio de `active`.
export async function deactivateSeller(id: string): Promise<SellerStatusChange> {
  const changed = await withTransaction(async (tx) => {
    const [seller] = await lockRows(tx, profiles, eq(profiles.id, id))
    if (!seller || seller.role !== 'vendedor' || seller.archivedAt) throw notFound()
    // Ya desactivado: responde igual, sin revisar piezas (idempotente, como setLoginActive).
    if (!seller.active) return false
    const rows = await lockRows(tx, vendorStock, eq(vendorStock.profileId, id))
    const units = rows.reduce((total, row) => total + row.qty, 0)
    if (units > 0) throw conflict(SELLER_HAS_UNITS)
    await tx.update(profiles).set({ active: false }).where(eq(profiles.id, id))
    return true
  })
  return withStatusEmail(await sellerView(await findSeller(id)), changed, 'deactivated')
}

// Reactivar a un vendedor (spec M13-t42). Ya activo responde sin cambios y sin aviso.
export async function reactivateSeller(id: string): Promise<SellerStatusChange> {
  const seller = await findSeller(id)
  if (seller.active) return { ...(await sellerView(seller)), emailStatus: null }
  const [updated] = await db.update(profiles).set({ active: true }).where(eq(profiles.id, id)).returning()
  return withStatusEmail(await sellerView(updated!), true, 'reactivated')
}

// Aviso por correo (spec M13-hu44): se manda ya confirmado el cambio, fuera de la transacción, para
// que un fallo o una demora del correo no pueda deshacerlo. Sin cambio no se manda nada.
async function withStatusEmail(
  view: SellerView,
  changed: boolean,
  kind: 'deactivated' | 'reactivated',
): Promise<SellerStatusChange> {
  if (!changed) return { ...view, emailStatus: null }
  const emailStatus = await sendSellerStatusEmail({ to: view.email, name: view.fullName, kind })
  return { ...view, emailStatus }
}

// Eliminar a un vendedor (spec M13-t42, M13-hu45 §10). Sin movimientos se borra de verdad (perfil y
// luego Auth). Con historial no se puede borrar sin descuadrar inventario y cortes: con piezas da 409
// y sin ellas se archiva (mismo candado que deactivateSeller) y su correo de Auth se libera.
export async function deleteSeller(id: string): Promise<void> {
  // El correo original se lee antes del candado, para no mantenerlo bloqueado esperando a Auth.
  await findSeller(id)
  const { data, error: readError } = await supabaseAdmin().auth.admin.getUserById(id)
  if (readError) throw readError
  const archivedEmail = data.user?.email ?? ''
  const wasActive = await withTransaction(async (tx) => {
    const [seller] = await lockRows(tx, profiles, eq(profiles.id, id))
    if (!seller || seller.role !== 'vendedor' || seller.archivedAt) throw notFound()
    const [moved] = await tx
      .select({ id: stockMovements.id })
      .from(stockMovements)
      .where(eq(stockMovements.holderProfileId, id))
      .limit(1)
    if (!moved) return null
    const rows = await lockRows(tx, vendorStock, eq(vendorStock.profileId, id))
    if (rows.reduce((total, row) => total + row.qty, 0) > 0) throw conflict(SELLER_HAS_UNITS)
    await tx
      .update(profiles)
      .set({ archivedAt: sql`now()`, active: false, archivedEmail })
      .where(eq(profiles.id, id))
    return seller.active
  })
  if (wasActive === null) return purgeSeller(id)

  // El perfil ya está archivado; si Auth no libera el correo se deshace (compensación), porque un
  // archivado con el correo aún tomado impediría el alta nueva que esta regla promete.
  const { error } = await supabaseAdmin().auth.admin.updateUserById(id, {
    email: `archivado-${id}@${ARCHIVED_EMAIL_DOMAIN}`,
    email_confirm: true,
  })
  if (error) {
    await db.update(profiles).set({ archivedAt: null, active: wasActive, archivedEmail: null }).where(eq(profiles.id, id))
    throw error
  }
}

// Borrado físico de un alta sin historial. La FK `restrict` es la red de seguridad si un movimiento
// aparece entre la lectura y el borrado.
async function purgeSeller(id: string): Promise<void> {
  try {
    await db.delete(profiles).where(eq(profiles.id, id))
  } catch (err) {
    if (isForeignKeyViolation(err)) throw conflict(SELLER_HISTORY_APPEARED)
    throw err
  }
  const { error } = await supabaseAdmin().auth.admin.deleteUser(id)
  if (error) throw error
}

// Contraseña temporal que escribe el administrador (spec M13-t42, M13-hu45). Después se cierran todas
// las sesiones del vendedor: un celular con la app abierta debe pedir entrar de nuevo. El aviso por correo
// sale al final y nunca recibe la contraseña; si falla, la contraseña ya cambió.
export async function setSellerPassword(id: string, password: string): Promise<{ emailStatus: EmailStatus }> {
  validatePassword(password)
  const profile = await findSeller(id)
  const { data, error } = await supabaseAdmin().auth.admin.updateUserById(id, { password })
  if (error) throw error
  await revokeSessions(id)
  const emailStatus = await sendSellerPasswordEmail({ to: data.user?.email ?? null, name: profile.fullName })
  return { emailStatus }
}
