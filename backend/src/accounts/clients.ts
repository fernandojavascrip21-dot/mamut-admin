import { asc, eq } from 'drizzle-orm'
import { db } from '@db/client'
import { isForeignKeyViolation, isUniqueViolation } from '@db/errors'
import { clients, profiles } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { conflict, notFound, validation } from '@lib/errors'
import { DUPLICATE_CLIENT_NAME } from './constants'

export interface ClientInput {
  name?: string
  contactName?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
}

export function listClients() {
  return db.select().from(clients).orderBy(asc(clients.name))
}

export async function getClient(id: number) {
  const [client] = await db.select().from(clients).where(eq(clients.id, id))
  if (!client) throw notFound('Cliente no encontrado')
  return client
}

export async function createClient(input: ClientInput & { name: string }) {
  try {
    const [client] = await db.insert(clients).values(input).returning()
    return client!
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(DUPLICATE_CLIENT_NAME)
    throw err
  }
}

export async function updateClient(id: number, input: ClientInput) {
  const changes = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined))
  if (Object.keys(changes).length === 0) throw validation('No hay campos para actualizar')
  try {
    const [client] = await db.update(clients).set(changes).where(eq(clients.id, id)).returning()
    if (!client) throw notFound('Cliente no encontrado')
    return client
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(DUPLICATE_CLIENT_NAME)
    throw err
  }
}

// Desactivar un cliente desactiva también todos sus logins, en la misma transacción.
export function deactivateClient(id: number) {
  return withTransaction(async (tx) => {
    const [client] = await tx
      .update(clients)
      .set({ active: false })
      .where(eq(clients.id, id))
      .returning()
    if (!client) throw notFound('Cliente no encontrado')
    await tx.update(profiles).set({ active: false }).where(eq(profiles.clientId, id))
    return client
  })
}

// Reactivar un cliente NO reactiva sus logins: el admin decide quién vuelve a entrar.
export async function reactivateClient(id: number) {
  const [client] = await db.update(clients).set({ active: true }).where(eq(clients.id, id)).returning()
  if (!client) throw notFound('Cliente no encontrado')
  return client
}

// Con historial (ventas, cortes, créditos, stock, merma) o con logins, las llaves foráneas
// `restrict` impiden el borrado: solo se desactiva.
export async function deleteClient(id: number): Promise<void> {
  try {
    const deleted = await db.delete(clients).where(eq(clients.id, id)).returning({ id: clients.id })
    if (deleted.length === 0) throw notFound('Cliente no encontrado')
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw conflict('El cliente tiene historial o accesos: solo se puede desactivar, no borrar')
    }
    throw err
  }
}
