import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, sql } from '@db/client'
import { products, stockMovements, vendorStock } from '@db/schema'
import { createDelivery } from '@deliveries'
import { createFraction } from '@fractions'
import { getOwnStock, getStockOverview } from '@inventory'
import { createProduct } from '@products'
import { createReturn } from '@returns'
import { createSale } from '@sales'
import { cleanupSales, cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-frac-h-inv-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// Movimientos del más nuevo al más viejo (revierten saldos), luego vendor_stock, fractions y productos.
async function cleanupAll() {
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
  await db.delete(vendorStock).where(inArray(vendorStock.productId, all))
  await sql`delete from fractions where product_id = any(${ids}) or portion_product_id = any(${all})`
  if (bags.length > 0) await db.delete(products).where(inArray(products.id, bags.map((bag) => bag.id)))
  await db.delete(products).where(inArray(products.id, ids))
}

describe.skipIf(!hasServiceKey)('La bolsita en los flujos de inventario (HU-24, base real)', () => {
  let admin: TestUser
  let seller: TestUser
  let wholeId: number
  let bagId: number

  const warehouseOf = async (id: number) => (await db.select().from(products).where(eq(products.id, id)))[0]!.stock

  beforeAll(async () => {
    admin = await createTestUser('frac-h-inv-admin', { role: 'admin' })
    seller = await createTestUser('frac-h-inv-seller', { role: 'vendedor' })
    const created = await createProduct({
      name: productName('entero'), categoryId: null, price: '900.00', unitCost: '450.0000', initialQty: 3,
      fractionable: true, portionSize: '250 g', image: null,
    }, admin.id)
    wholeId = created.id as number
    const { fraction } = await createFraction(
      { requestId: randomUUID(), productId: wholeId, portions: 7, price: '85.00' },
      { userId: admin.id, role: 'admin' },
    )
    bagId = fraction.portionProduct.id
  })
  afterAll(async () => {
    await cleanupSales()
    await cleanupAll()
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  })

  it('«Stock general» cuenta la bolsita en la bodega y el entero baja', async () => {
    const overview = await getStockOverview()
    expect(overview.products.find((row) => row.productId === bagId)).toMatchObject({ warehouse: 7, total: 7 })
    expect(overview.products.find((row) => row.productId === wholeId)).toMatchObject({ warehouse: 2 })
  })

  it('se deja a un vendedor y aparece en su stock', async () => {
    const { delivery } = await createDelivery({
      requestId: randomUUID(), sellerId: seller.id, productId: bagId, qty: 4, unitPrice: null, unitCostWithShipping: null,
    }, admin.id)
    expect(delivery.qty).toBe(4)
    expect(await warehouseOf(bagId)).toBe(3)
    const own = await getOwnStock(seller.id)
    expect(own.products.find((row) => row.productId === bagId)?.units).toBe(4)
  })

  it('se retira una pieza del vendedor y vuelve a la bodega', async () => {
    await createReturn({ requestId: randomUUID(), sellerId: seller.id, productId: bagId, qty: 1 }, admin.id)
    expect(await warehouseOf(bagId)).toBe(4)
    const own = await getOwnStock(seller.id)
    expect(own.products.find((row) => row.productId === bagId)?.units).toBe(3)
  })

  it('el vendedor la vende y su stock baja', async () => {
    const { sale } = await createSale(
      { requestId: randomUUID(), holderId: seller.id, lines: [{ productId: bagId, qty: 2 }] },
      { userId: seller.id, role: 'vendedor' },
    )
    expect(sale).toBeDefined()
    const own = await getOwnStock(seller.id)
    expect(own.products.find((row) => row.productId === bagId)?.units).toBe(1)
  })
})
