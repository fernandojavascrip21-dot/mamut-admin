import { and, asc, eq } from 'drizzle-orm'
import { db } from '@db/client'
import { isForeignKeyViolation } from '@db/errors'
import { clients, profiles } from '@db/schema'
import { conflict, notFound } from '@lib/errors'
import { supabaseAdmin } from '@lib/supabase'
import { createAccount, toView, validatePassword, type AccountView } from './accounts'

type Profile = typeof profiles.$inferSelect

export type LoginView = AccountView

// Solo opera sobre logins de cliente; los administradores se gestionan en /api/admins.
async function getClientLogin(id: string): Promise<Profile> {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, id), eq(profiles.role, 'client')))
  if (!profile) throw notFound('Login no encontrado')
  return profile
}

export async function listLogins(clientId: number): Promise<LoginView[]> {
  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId))
  if (!client) throw notFound('Cliente no encontrado')
  const rows = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.clientId, clientId), eq(profiles.role, 'client')))
    .orderBy(asc(profiles.fullName))
  return Promise.all(rows.map(toView))
}

// El login nace activo solo si su cliente está activo.
export async function createLogin(
  clientId: number,
  input: { email: string; password: string; fullName: string },
): Promise<LoginView> {
  const [client] = await db
    .select({ id: clients.id, active: clients.active })
    .from(clients)
    .where(eq(clients.id, clientId))
  if (!client) throw notFound('Cliente no encontrado')

  return createAccount(input, { role: 'client', clientId, active: client.active })
}

export async function updateLogin(id: string, input: { fullName: string }): Promise<LoginView> {
  await getClientLogin(id)
  const [profile] = await db
    .update(profiles)
    .set({ fullName: input.fullName })
    .where(eq(profiles.id, id))
    .returning()
  return toView(profile!)
}

export async function setLoginActive(id: string, active: boolean): Promise<LoginView> {
  await getClientLogin(id)
  const [profile] = await db.update(profiles).set({ active }).where(eq(profiles.id, id)).returning()
  return toView(profile!)
}

// El admin asigna la contraseña nueva; el cliente no puede cambiarla por su cuenta (RF-01.8).
export async function setLoginPassword(id: string, password: string): Promise<void> {
  validatePassword(password)
  await getClientLogin(id)
  const { error } = await supabaseAdmin().auth.admin.updateUserById(id, { password })
  if (error) throw error
}

// Con historial (ventas, abonos, mermas) la llave foránea `restrict` impide borrar el perfil: 409.
// Primero se borra el perfil; la cuenta de Auth solo se elimina si eso salió bien.
export async function deleteLogin(id: string): Promise<void> {
  await getClientLogin(id)
  try {
    await db.delete(profiles).where(eq(profiles.id, id))
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw conflict('El acceso tiene historial: solo se puede desactivar, no borrar')
    }
    throw err
  }
  const { error } = await supabaseAdmin().auth.admin.deleteUser(id)
  if (error) throw error
}
