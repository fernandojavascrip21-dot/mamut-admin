import { eq, like } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db, sql } from '../src/db/client'
import { categories } from '../src/db/schema'
import { lockRows, withTransaction } from '../src/db/transaction'

// Datos de prueba con prefijo identificable; se limpian antes y después.
const PREFIX = 'test-tx-'

async function cleanup() {
  await db.delete(categories).where(like(categories.slug, `${PREFIX}%`))
}

beforeEach(cleanup)
afterAll(async () => {
  await cleanup()
  await sql.end()
})

describe('withTransaction', () => {
  it('hace rollback si el caso de uso lanza un error', async () => {
    await expect(
      withTransaction(async (tx) => {
        await tx.insert(categories).values({ name: `${PREFIX}rollback`, slug: `${PREFIX}rollback` })
        throw new Error('falla a medio caso de uso')
      }),
    ).rejects.toThrow('falla a medio caso de uso')

    const rows = await db.select().from(categories).where(eq(categories.slug, `${PREFIX}rollback`))
    expect(rows).toHaveLength(0)
  })

  it('confirma los cambios cuando el caso de uso termina bien', async () => {
    await withTransaction(async (tx) => {
      await tx.insert(categories).values({ name: `${PREFIX}commit`, slug: `${PREFIX}commit` })
    })

    const rows = await db.select().from(categories).where(eq(categories.slug, `${PREFIX}commit`))
    expect(rows).toHaveLength(1)
  })
})

describe('lockRows', () => {
  it('devuelve los renglones bloqueados con select ... for update', async () => {
    await db.insert(categories).values({ name: `${PREFIX}lock`, slug: `${PREFIX}lock` })

    const locked = await withTransaction((tx) =>
      lockRows(tx, categories, eq(categories.slug, `${PREFIX}lock`)),
    )

    expect(locked).toHaveLength(1)
    expect(locked[0]?.slug).toBe(`${PREFIX}lock`)
  })

  it('una segunda transacción espera mientras la primera tiene el renglón bloqueado', async () => {
    await db.insert(categories).values({ name: `${PREFIX}wait`, slug: `${PREFIX}wait` })
    const order: string[] = []

    let releaseFirst!: () => void
    const firstHolds = new Promise<void>((resolve) => (releaseFirst = resolve))
    let firstLocked!: () => void
    const firstHasLock = new Promise<void>((resolve) => (firstLocked = resolve))

    const first = withTransaction(async (tx) => {
      await lockRows(tx, categories, eq(categories.slug, `${PREFIX}wait`))
      firstLocked()
      await firstHolds
      order.push('primera termina')
    })

    await firstHasLock
    const second = withTransaction(async (tx) => {
      await lockRows(tx, categories, eq(categories.slug, `${PREFIX}wait`))
      order.push('segunda obtiene el bloqueo')
    })

    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(order).toEqual([])
    releaseFirst()
    await Promise.all([first, second])
    expect(order).toEqual(['primera termina', 'segunda obtiene el bloqueo'])
  })
})
