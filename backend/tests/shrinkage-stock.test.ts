import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, sql } from '@db/client'
import { products, stockMovements, vendorStock } from '@db/schema'
import { createDelivery } from '@deliveries'
import { getOwnStock, getStockOverview } from '@inventory'
import { createProduct } from '@products'
import { createShrinkage } from '@shrinkage'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-shrs-'
const productName = () => `${PREFIX}${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// Movimientos del más nuevo al más viejo (revierten saldos), las filas de vendor_stock que quedan en 0
// y luego los productos de prueba.
async function cleanupShrinkageStock() {
  const rows = await db.select({ id: products.id }).from(products).where(ilike(products.name, `${PREFIX}%`))
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return
  const movements = await db.select({ id: stockMovements.id }).from(stockMovements)
    .where(inArray(stockMovements.productId, ids)).orderBy(desc(stockMovements.id))
  for (const movement of movements) {
    await db.delete(stockMovements).where(eq(stockMovements.id, movement.id))
  }
  await db.delete(vendorStock).where(inArray(vendorStock.productId, ids))
  await db.delete(products).where(inArray(products.id, ids))
}

describe.skipIf(!hasServiceKey)('Una merma baja el stock general y «Mi stock» (HU-26, base real)', () => {
  let admin: TestUser
  let seller: TestUser

  const asAdmin = () => ({ userId: admin.id, role: 'admin' })

  const newProduct = async (warehouse: number, toSeller: number) => {
    const created = await createProduct({
      name: productName(),
      categoryId: null,
      price: '900.00',
      unitCost: '450.0000',
      initialQty: warehouse + toSeller,
      fractionable: false,
      portionSize: null,
      image: null,
    }, admin.id)
    const id = created.id as number
    if (toSeller > 0) {
      await createDelivery({
        requestId: randomUUID(), sellerId: seller.id, productId: id, qty: toSeller, unitPrice: null, unitCostWithShipping: null,
      }, admin.id)
    }
    return id
  }

  const shrink = (productId: number, qty: number, holderProfileId: string | null) =>
    createShrinkage({ requestId: randomUUID(), holderProfileId, productId, qty, reason: 'damaged' }, asAdmin())

  const overviewOf = async (productId: number) => {
    const overview = await getStockOverview()
    const line = overview.products.find((product) => product.productId === productId)!
    const sellerUnits = overview.sellers.find((row) => row.id === seller.id)?.units ?? 0
    return { line, sellerUnits }
  }

  beforeAll(async () => {
    admin = await createTestUser('shrs-admin', { role: 'admin' })
    seller = await createTestUser('shrs-seller', { role: 'vendedor' })
  }, 60_000)
  afterAll(async () => {
    await cleanupShrinkageStock()
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  }, 60_000)

  it('una merma de 2 piezas del vendedor baja su stock y el total del producto, y la bodega no cambia', async () => {
    const id = await newProduct(4, 6)
    const before = await overviewOf(id)
    await shrink(id, 2, seller.id)
    const after = await overviewOf(id)
    expect(after.sellerUnits).toBe(before.sellerUnits - 2)
    expect(after.line.total).toBe(before.line.total - 2)
    expect(after.line.warehouse).toBe(before.line.warehouse)
    expect(after.line.warehouse).toBe(4)
  })

  it('una merma de la bodega baja la bodega y el total del producto', async () => {
    const id = await newProduct(10, 0)
    const before = await overviewOf(id)
    await shrink(id, 3, null)
    const after = await overviewOf(id)
    expect(after.line.warehouse).toBe(before.line.warehouse - 3)
    expect(after.line.total).toBe(before.line.total - 3)
    expect(after.line.warehouse).toBe(7)
  })

  it('una merma que deja 2 piezas da stockLevel «low»', async () => {
    const id = await newProduct(0, 5)
    await shrink(id, 3, seller.id)
    const { line } = await overviewOf(id)
    expect(line.sellers.find((row) => row.sellerId === seller.id)).toMatchObject({ units: 2, stockLevel: 'low' })
    const own = await getOwnStock(seller.id)
    expect(own.products.find((product) => product.productId === id)).toMatchObject({ units: 2, stockLevel: 'low' })
  })

  it('una merma que deja al vendedor en 0 da stockLevel «out»', async () => {
    const id = await newProduct(0, 3)
    await shrink(id, 3, seller.id)
    const own = await getOwnStock(seller.id, { includeSoldOut: true })
    expect(own.products.find((product) => product.productId === id)).toMatchObject({ units: 0, stockLevel: 'out' })
  })

  it('«Mi stock» trae las piezas descontadas, sin costos', async () => {
    const id = await newProduct(0, 6)
    await shrink(id, 2, seller.id)
    const own = await getOwnStock(seller.id)
    const line = own.products.find((product) => product.productId === id)!
    expect(line.units).toBe(4)
    expect(Object.keys(line).sort()).toEqual(['image', 'name', 'price', 'productId', 'stockLevel', 'units'])
  })

  it('con 0 piezas el producto sale de «Mi stock»', async () => {
    const id = await newProduct(0, 2)
    await shrink(id, 2, seller.id)
    const own = await getOwnStock(seller.id)
    expect(own.products.some((product) => product.productId === id)).toBe(false)
  })
})
