import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, sql } from '@db/client'
import { products } from '@db/schema'
import { createRestockOrder, getRestockOrder, listRestockOrders, updateRestockOrder, type RestockOrder } from '@restock'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'
import { cleanupRestockData, createRestockProduct, RESTOCK_PREFIX } from './helpers/restock'

// Costo editable por renglón y total estimado (HU-31): el costo del pedido no toca products.unit_cost
// y el redondeo a centavos se hace una sola vez, sobre la suma.
describe.skipIf(!hasServiceKey)('Estimado de pedidos de resurtir (HU-31, base real)', () => {
  let admin: TestUser
  const asAdmin = () => ({ userId: admin.id, role: 'admin' })
  const create = async (lines: unknown[]): Promise<RestockOrder> =>
    (await createRestockOrder({ requestId: randomUUID(), note: null, lines } as never, asAdmin())).order
  const update = (id: number, lines: unknown[]) => updateRestockOrder(id, { note: null, lines } as never, asAdmin())
  const productCost = async (id: number) => {
    const [row] = await db.select({ unitCost: products.unitCost }).from(products).where(eq(products.id, id))
    return String(row!.unitCost)
  }
  const written = (label: string, qty: number, unitCost: string | null) =>
    ({ name: `${RESTOCK_PREFIX}est-${label}-${Date.now()}`, qty, unitCost })

  beforeAll(async () => {
    admin = await createTestUser('rst-est-admin', { role: 'admin' })
  })
  afterAll(async () => {
    await cleanupRestockData(admin?.id)
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  })

  it('un unitCost editado se guarda en el renglón sin cambiar products.unit_cost', async () => {
    const a = await createRestockProduct(admin.id, { unitCost: '450.0000', label: 'edit' })
    const order = await create([{ productId: a, qty: 2, unitCost: '12.3456' }])
    expect(order.lines[0]).toMatchObject({ qty: 2, unitCost: '12.3456' })
    expect(await productCost(a)).toBe('450.0000')
    await update(order.id, [{ productId: a, qty: 2, unitCost: '13.0000' }])
    expect(await productCost(a)).toBe('450.0000')
  })

  it('un renglón nuevo sin unitCost toma el costo actual del producto', async () => {
    const a = await createRestockProduct(admin.id, { unitCost: '77.7700', label: 'actual' })
    const order = await create([{ productId: a, qty: 1 }])
    expect(order.lines[0]!.unitCost).toBe('77.7700')
  })

  it('un renglón existente conserva su costo en un PUT sin unitCost, aunque el producto cambie', async () => {
    const a = await createRestockProduct(admin.id, { unitCost: '10.0000', label: 'conserva' })
    const order = await create([{ productId: a, qty: 1 }])
    await db.update(products).set({ unitCost: '99.0000' }).where(eq(products.id, a))
    const updated = await update(order.id, [{ productId: a, qty: 4 }])
    expect(updated.lines[0]).toMatchObject({ qty: 4, unitCost: '10.0000' })
  })

  it('estimatedTotal con costos de 4 decimales se redondea una sola vez: 31.00', async () => {
    const order = await create([written('a', 3, '10.3333')])
    expect(order.estimatedTotal).toBe('31.00')
  })

  it('estimatedTotal redondea la suma, no cada renglón (15.5025 + 15.5025 = 31.01)', async () => {
    const order = await create([written('b', 1, '15.5025'), written('c', 1, '15.5025')])
    expect(order.estimatedTotal).toBe('31.01')
  })

  it('suma catálogo y escritos, y los costos null cuentan 0', async () => {
    const a = await createRestockProduct(admin.id, { label: 'suma' })
    const order = await create([{ productId: a, qty: 2, unitCost: '10.5000' }, written('d', 1, '10.0000'), written('e', 5, null)])
    expect(order.estimatedTotal).toBe('31.00')
  })

  it('un pedido vacío o solo con costos null da 0.00', async () => {
    expect((await create([])).estimatedTotal).toBe('0.00')
    expect((await create([written('f', 3, null)])).estimatedTotal).toBe('0.00')
  })

  it('el detalle, la lista y un PUT traen el mismo estimatedTotal', async () => {
    const order = await create([written('g', 1, '15.5025'), written('h', 1, '15.5025')])
    expect((await getRestockOrder(order.id, asAdmin())).estimatedTotal).toBe('31.01')
    const { orders } = await listRestockOrders({}, asAdmin())
    expect(orders.find((o) => o.id === order.id)!.estimatedTotal).toBe('31.01')
    const updated = await update(order.id, [written('i', 3, '10.3333')])
    expect(updated.estimatedTotal).toBe('31.00')
  })
})
