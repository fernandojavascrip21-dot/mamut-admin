import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, sql } from '@db/client'
import { products } from '@db/schema'
import { createFraction } from '@fractions'
import { createProduct } from '@products'
import { listRestockProducts } from '@restock'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'
import { cleanupRestockData, createRestockProduct, restockProductName, RESTOCK_PREFIX } from './helpers/restock'

// GET /api/restock/products (HU-31): productos que se pueden pedir, todos, no solo los de baja existencia.
describe.skipIf(!hasServiceKey)('Productos pedibles de resurtir (HU-31, base real)', () => {
  let admin: TestUser
  let seller: TestUser
  const asAdmin = () => ({ userId: admin.id, role: 'admin' })
  const asSeller = () => ({ userId: seller.id, role: 'vendedor' })
  const mine = async () => (await listRestockProducts(asAdmin())).products.filter((p) => p.name.startsWith(RESTOCK_PREFIX))

  beforeAll(async () => {
    admin = await createTestUser('rst-prod-admin', { role: 'admin' })
    seller = await createTestUser('rst-prod-seller', { role: 'vendedor' })
  })
  afterAll(async () => {
    await cleanupRestockData(admin?.id)
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  })

  it('trae productos con existencia suficiente y con 0, con units, stockLevel y unitCost', async () => {
    const ok = await createRestockProduct(admin.id, { qty: 20, unitCost: '12.5000', label: 'ok' })
    const out = await createRestockProduct(admin.id, { qty: 0, unitCost: '99.1234', label: 'out' })
    const list = await mine()
    expect(list.find((p) => p.productId === ok)).toMatchObject({ units: 20, stockLevel: 'ok', unitCost: '12.5000', image: null })
    expect(list.find((p) => p.productId === out)).toMatchObject({ units: 0, stockLevel: 'out', unitCost: '99.1234' })
  })

  it('trae un producto con baja existencia con stockLevel low', async () => {
    const low = await createRestockProduct(admin.id, { qty: 2, label: 'low' })
    expect((await mine()).find((p) => p.productId === low)).toMatchObject({ units: 2, stockLevel: 'low' })
  })

  it('no trae productos desactivados ni bolsitas', async () => {
    const inactive = await createRestockProduct(admin.id, { label: 'inactivo' })
    await db.update(products).set({ active: false }).where(eq(products.id, inactive))
    const whole = await createProduct({
      name: restockProductName('entero'), categoryId: null, price: '900.00', unitCost: '450.0000',
      initialQty: 3, fractionable: true, portionSize: '250 g', image: null,
    }, admin.id)
    const { fraction } = await createFraction(
      { requestId: randomUUID(), productId: whole.id as number, portions: 2, price: '900.00' }, asAdmin())
    const ids = (await mine()).map((p) => p.productId)
    expect(ids).not.toContain(inactive)
    expect(ids).not.toContain(fraction.portionProduct.id)
    expect(ids).toContain(whole.id)
  })

  it('va ordenado por nombre', async () => {
    await createRestockProduct(admin.id, { label: 'zz-orden' })
    await createRestockProduct(admin.id, { label: 'aa-orden' })
    const names = (await mine()).map((p) => p.name)
    expect(names).toEqual([...names].sort((x, y) => x.localeCompare(y, 'es')))
  })

  it('un vendedor recibe 403', async () => {
    await expect(listRestockProducts(asSeller())).rejects.toMatchObject({ code: 'forbidden' })
  })
})
