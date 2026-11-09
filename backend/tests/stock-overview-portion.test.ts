import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, sql } from '@db/client'
import { products, stockMovements, vendorStock } from '@db/schema'
import { createDelivery } from '@deliveries'
import { createFraction } from '@fractions'
import { getStockOverview } from '@inventory'
import { createProduct } from '@products'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-sop-'
const productName = () => `${PREFIX}${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// Movimientos del más nuevo al más viejo (revierten saldos), vendor_stock, fraccionados, bolsitas y enteros.
async function cleanupPortions() {
  const rows = await db.select({ id: products.id }).from(products).where(ilike(products.name, `${PREFIX}%`))
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return
  const movements = await db.select({ id: stockMovements.id }).from(stockMovements)
    .where(inArray(stockMovements.productId, ids)).orderBy(desc(stockMovements.id))
  for (const movement of movements) {
    await db.delete(stockMovements).where(eq(stockMovements.id, movement.id))
  }
  await db.delete(vendorStock).where(inArray(vendorStock.productId, ids))
  await sql`delete from fractions where product_id = any(${ids}) or portion_product_id = any(${ids})`
  await db.delete(products).where(inArray(products.parentProductId, ids))
  await db.delete(products).where(inArray(products.id, ids))
}

describe.skipIf(!hasServiceKey)('GET /api/stock marca las bolsitas con parentProductId (HU-26 §13, base real)', () => {
  let admin: TestUser
  let seller: TestUser
  let wholeId: number
  let bagId: number

  beforeAll(async () => {
    admin = await createTestUser('sop-admin', { role: 'admin' })
    seller = await createTestUser('sop-seller', { role: 'vendedor' })
    const created = await createProduct({
      name: productName(), categoryId: null, price: '900.00', unitCost: '450.0000', initialQty: 3,
      fractionable: true, portionSize: '250 g', image: null,
    }, admin.id)
    wholeId = created.id as number
    const { fraction } = await createFraction(
      { requestId: randomUUID(), productId: wholeId, portions: 7, price: '85.00' },
      { userId: admin.id, role: 'admin' },
    )
    bagId = fraction.portionProduct.id
    await createDelivery({
      requestId: randomUUID(), sellerId: seller.id, productId: bagId, qty: 4, unitPrice: null, unitCostWithShipping: null,
    }, admin.id)
  })
  afterAll(async () => {
    await cleanupPortions()
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  })

  it('la bolsita dejada a un vendedor trae el id del entero y las piezas del vendedor', async () => {
    const overview = await getStockOverview()
    const bag = overview.products.find((row) => row.productId === bagId)
    expect(bag).toMatchObject({ parentProductId: wholeId, warehouse: 3, total: 7 })
    expect(bag?.sellers).toEqual([expect.objectContaining({ sellerId: seller.id, units: 4 })])
  })

  it('un entero trae parentProductId null', async () => {
    const overview = await getStockOverview()
    expect(overview.products.find((row) => row.productId === wholeId)).toMatchObject({ parentProductId: null })
  })
})
