import { and, asc, eq } from 'drizzle-orm'
import { db } from '@db/client'
import { profiles } from '@db/schema'
import { lockRows, withTransaction } from '@db/transaction'
import { AppError, conflict, notFound } from '@lib/errors'
import { createAccount, toView, type AccountView } from './accounts'

export type AdminView = AccountView

// Reglas de desactivación: no a sí mismo, y siempre debe quedar al menos un admin activo.
export function checkAdminDeactivation(params: {
  targetId: string
  actorId: string
  activeAdminIds: string[]
}): AppError | null {
  if (params.targetId === params.actorId) {
    return conflict('No puedes desactivar tu propia cuenta')
  }
  if (params.activeAdminIds.filter((id) => id !== params.targetId).length === 0) {
    return conflict('Debe quedar al menos un administrador activo')
  }
  return null
}

export async function listAdmins(): Promise<AdminView[]> {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.role, 'admin'))
    .orderBy(asc(profiles.fullName))
  return Promise.all(rows.map(toView))
}

export function createAdmin(input: { email: string; password: string; fullName: string }) {
  return createAccount(input, { role: 'admin', clientId: null, active: true })
}

// Se bloquean los perfiles de admin (`for update`) para que dos desactivaciones simultáneas
// no dejen al sistema sin administradores activos.
export async function deactivateAdmin(actorId: string, targetId: string): Promise<AdminView> {
  const target = await withTransaction(async (tx) => {
    const admins = await lockRows(tx, profiles, eq(profiles.role, 'admin'))
    const found = admins.find((a) => a.id === targetId)
    if (!found) throw notFound('Administrador no encontrado')

    const error = checkAdminDeactivation({
      targetId,
      actorId,
      activeAdminIds: admins.filter((a) => a.active).map((a) => a.id),
    })
    if (error) throw error

    const [updated] = await tx.update(profiles).set({ active: false }).where(eq(profiles.id, targetId)).returning()
    return updated!
  })
  return toView(target)
}

export async function reactivateAdmin(targetId: string): Promise<AdminView> {
  const [updated] = await db
    .update(profiles)
    .set({ active: true })
    .where(and(eq(profiles.id, targetId), eq(profiles.role, 'admin')))
    .returning()
  if (!updated) throw notFound('Administrador no encontrado')
  return toView(updated)
}
