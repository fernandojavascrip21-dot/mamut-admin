import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, sql } from '@db/client'
import { products, stockMovements, vendorStock } from '@db/schema'
import { createFraction } from '@fractions'
import { createProduct } from '@products'
import { listReceiptProducts } from '@receipts'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-rcp-'
const uniqueName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// GET /api/receipts/products (HU-42): catálogo que el administrador puede elegir al corregir una vista previa.
describe.skipIf(!hasServiceKey)('Productos para corregir una remisión (HU-42, base real)', () => {
  let admin: TestUser
  let seller: TestUser
  const asAdmin = () => ({ userId: admin.id, role: 'admin' })
  const asSeller = () => ({ userId: seller.id, role: 'vendedor' })
  const mine = async () => (await listReceiptProducts(asAdmin())).products.filter((p) => p.name.startsWith(PREFIX))
  const make = async (label: string, extra: { qty?: number; unitCost?: string; fractionable?: boolean } = {}) => {
    const name = uniqueName(label)
    const created = await createProduct({
      name, categoryId: null, price: '900.00', unitCost: extra.unitCost ?? '450.0000',
      initialQty: extra.qty ?? 5, fractionable: extra.fractionable ?? false,
      portionSize: extra.fractionable ? '250 g' : null, image: null,
    }, admin.id)
    return { id: created.id as number, name }
  }

  beforeAll(async () => {
    admin = await createTestUser('rcp-prod-admin', { role: 'admin' })
    seller = await createTestUser('rcp-prod-seller', { role: 'vendedor' })
  })
  afterAll(async () => {
    const rows = await db.select({ id: products.id }).from(products).where(ilike(products.name, `${PREFIX}%`))
    const ids = rows.map((row) => row.id)
    if (ids.length > 0) {
      const movements = await db.select({ id: stockMovements.id }).from(stockMovements)
        .where(inArray(stockMovements.productId, ids)).orderBy(desc(stockMovements.id))
      for (const movement of movements) await db.delete(stockMovements).where(eq(stockMovements.id, movement.id))
      await db.delete(vendorStock).where(inArray(vendorStock.productId, ids))
      await sql`delete from fractions where product_id = any(${ids}) or portion_product_id = any(${ids})`
      const portions = await db.select({ id: products.id }).from(products).where(inArray(products.parentProductId, ids))
      if (portions.length > 0) await db.delete(products).where(inArray(products.id, portions.map((p) => p.id)))
      await db.delete(products).where(inArray(products.id, ids))
    }
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  })

  it('trae los productos activos y no los desactivados', async () => {
    const active = await make('activo')
    const inactive = await make('inactivo')
    await db.update(products).set({ active: false }).where(eq(products.id, inactive.id))
    const ids = (await mine()).map((p) => p.id)
    expect(ids).toContain(active.id)
    expect(ids).not.toContain(inactive.id)
  })

  it('incluye la bolsita activa de un producto fraccionado', async () => {
    const whole = await make('entero', { qty: 3, fractionable: true })
    const { fraction } = await createFraction(
      { requestId: randomUUID(), productId: whole.id, portions: 2, price: '900.00' }, asAdmin())
    const ids = (await mine()).map((p) => p.id)
    expect(ids).toContain(whole.id)
    expect(ids).toContain(fraction.portionProduct.id)
  })

  it('cada producto trae solo id, name, image, unitCost (4 decimales) y units', async () => {
    const item = await make('forma', { unitCost: '12.5' })
    const found = (await mine()).find((p) => p.id === item.id)
    expect(found).toEqual({ id: item.id, name: item.name, image: null, unitCost: '12.5000', units: 5 })
  })

  it('units es products.stock (la bodega)', async () => {
    const item = await make('unidades', { qty: 17 })
    const [row] = await db.select({ stock: products.stock }).from(products).where(eq(products.id, item.id))
    const found = (await mine()).find((p) => p.id === item.id)
    expect(found?.units).toBe(row!.stock)
    expect(found?.units).toBe(17)
  })

  it('va ordenado por nombre sin acentos ni mayúsculas', async () => {
    const zeta = await make('Zeta')
    const alamo = await make('Álamo')
    const beta = await make('beta')
    const ordered = (await mine()).map((p) => p.id).filter((id) => [zeta.id, alamo.id, beta.id].includes(id))
    expect(ordered).toEqual([alamo.id, beta.id, zeta.id])
  })

  it('un vendedor recibe 403', async () => {
    await expect(listReceiptProducts(asSeller())).rejects.toMatchObject({ code: 'forbidden' })
  })
})
