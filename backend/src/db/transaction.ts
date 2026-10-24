import type { SQL } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { db } from './client'

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Un caso de uso = una transacción: si `fn` lanza, se hace rollback completo.
export function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(fn)
}

// `select ... for update`: bloquea los renglones hasta que termine la transacción.
// Se usa sobre las filas de stock antes de leer y modificar contadores.
export async function lockRows<T extends PgTable>(
  tx: Tx,
  table: T,
  where: SQL,
): Promise<T['$inferSelect'][]> {
  const rows = await tx.select().from(table as PgTable).where(where).for('update')
  return rows as T['$inferSelect'][]
}
