import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as productsRoute } from '@api/products/route'
import { db, sql } from '@db/client'
import { products, stockMovements } from '@db/schema'
import { createFraction } from '@fractions'
import { createProduct } from '@products'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-frac-h-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

interface Row {
  id: number
  name: string
  parentProductId?: number | null
  portionUnitCost?: string | null
  unitCost?: string
}

// Movimientos del más nuevo al más viejo (revierten saldos), luego fractions, bolsitas y enteros.
async function cleanupFractions() {
  const rows = await db.select({ id: products.id }).from(products).where(ilike(products.name, `${PREFIX}%`))
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return
  const bags = await db.select({ id: products.id }).from(products).where(inArray(products.parentProductId, ids))
  const all = [...ids, ...bags.map((bag) => bag.id)]
  const movements = await db.select({ id: stockMovements.id }).from(stockMovements)
    .where(inArray(stockMovements.productId, all)).orderBy(desc(stockMovements.id))
  for (const movement of movements) {
    await db.delete(stockMovements).where(eq(stockMovements.id, movement.id))
  }
  await sql`delete from fractions where product_id = any(${ids}) or portion_product_id = any(${all})`
  if (bags.length > 0) await db.delete(products).where(inArray(products.id, bags.map((bag) => bag.id)))
  await db.delete(products).where(inArray(products.id, ids))
}

describe.skipIf(!hasServiceKey)('GET /api/products · costo de la bolsita (HU-24, base real)', () => {
  let admin: TestUser
  let normalId: number
  let wholeId: number
  let bagId: number
  let rows: Row[]

  const newProduct = async (label: string, fractionable: boolean) => {
    const created = await createProduct({
      name: productName(label), categoryId: null, price: '900.00', unitCost: '450.0000', initialQty: 3,
      fractionable, portionSize: fractionable ? '250 g' : null, image: null,
    }, admin.id)
    return created.id as number
  }
  const rowOf = (id: number) => rows.find((row) => row.id === id)!

  beforeAll(async () => {
    admin = await createTestUser('frac-h-prod-admin', { role: 'admin' })
    normalId = await newProduct('normal', false)
    wholeId = await newProduct('entero', true)
    const { fraction } = await createFraction(
      { requestId: randomUUID(), productId: wholeId, portions: 7, price: '85.00' },
      { userId: admin.id, role: 'admin' },
    )
    bagId = fraction.portionProduct.id
    const response = await productsRoute(
      new Request('http://api.test/api/products', { headers: { authorization: `Bearer ${admin.token}` } }),
      undefined,
    )
    rows = (await response.json()) as Row[]
  })
  afterAll(async () => {
    await cleanupFractions()
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  })

  it('la bolsita trae parentProductId del entero y portionUnitCost de 4 decimales', () => {
    expect(rowOf(bagId).parentProductId).toBe(wholeId)
    expect(rowOf(bagId).portionUnitCost).toBe('64.2857')
  })

  it('el entero fraccionable trae parentProductId y portionUnitCost en null', () => {
    expect(rowOf(wholeId).parentProductId).toBeNull()
    expect(rowOf(wholeId).portionUnitCost).toBeNull()
  })

  it('un producto normal trae parentProductId y portionUnitCost en null', () => {
    expect(rowOf(normalId).parentProductId).toBeNull()
    expect(rowOf(normalId).portionUnitCost).toBeNull()
  })

  it('ninguna fila trae unitCost', () => {
    for (const id of [normalId, wholeId, bagId]) expect(rowOf(id)).not.toHaveProperty('unitCost')
  })
})
