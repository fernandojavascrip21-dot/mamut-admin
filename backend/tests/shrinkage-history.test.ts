import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, sql } from '@db/client'
import { products, profiles, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { createDelivery } from '@deliveries'
import { createProduct } from '@products'
import {
  createShrinkage, listShrinkages, SELLER_SHRINKAGE_HISTORY_LIMIT, SHRINKAGE_HISTORY_LIMIT,
  type ShrinkageHistoryFilter, type ShrinkageHistoryItem,
} from '@shrinkage'
import { insertMovements } from '@stock'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-shrh-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// Movimientos del más nuevo al más viejo (revierten saldos), las filas de vendor_stock que quedan en 0
// y luego los productos de prueba.
async function cleanupHistory() {
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

describe.skipIf(!hasServiceKey)('Historial de mermas (HU-26, base real)', () => {
  let admin: TestUser
  let seller: TestUser
  let otherSeller: TestUser
  let leaver: TestUser
  let inactiveSeller: TestUser

  const asAdmin = () => ({ userId: admin.id, role: 'admin' })
  const ALL: ShrinkageHistoryFilter = { scope: 'all', limit: 1000 }
  const ofSeller = (sellerId: string, limit = 1000): ShrinkageHistoryFilter => ({ scope: 'seller', sellerId, limit })
  // Solo las filas de esta prueba: la base puede traer mermas de otros datos.
  const mine = (rows: ShrinkageHistoryItem[]) => rows.filter((row) => row.product.name.startsWith(PREFIX))

  const newProduct = async (label: string, warehouse: number, deliveries: [TestUser, number][] = []) => {
    const created = await createProduct({
      name: productName(label),
      categoryId: null,
      price: '900.00',
      unitCost: '450.0000',
      initialQty: warehouse + deliveries.reduce((sum, [, qty]) => sum + qty, 0),
      fractionable: false,
      portionSize: null,
      image: null,
    }, admin.id)
    const id = created.id as number
    for (const [user, qty] of deliveries) {
      await createDelivery({
        requestId: randomUUID(), sellerId: user.id, productId: id, qty, unitPrice: null, unitCostWithShipping: null,
      }, admin.id)
    }
    return id
  }

  const shrink = (productId: number, qty: number, holderProfileId: string | null, reason = 'damaged') =>
    createShrinkage({ requestId: randomUUID(), holderProfileId, productId, qty, reason }, asAdmin())

  beforeAll(async () => {
    admin = await createTestUser('shrh-admin', { role: 'admin' })
    seller = await createTestUser('shrh-seller', { role: 'vendedor' })
    otherSeller = await createTestUser('shrh-other', { role: 'vendedor' })
    leaver = await createTestUser('shrh-leaver', { role: 'vendedor' })
    inactiveSeller = await createTestUser('shrh-inactive', { role: 'vendedor', active: false })
  }, 60_000)
  afterAll(async () => {
    await cleanupHistory()
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  }, 60_000)

  it('devuelve las mermas de la más nueva a la más vieja, con qty en positivo, reasonLabel, titular y producto', async () => {
    const id = await newProduct('orden', 5, [[seller, 6]])
    await shrink(id, 1, seller.id, 'lost')
    await shrink(id, 2, null, 'expired')
    await shrink(id, 3, seller.id, 'damaged')
    const rows = (await listShrinkages(ofSeller(seller.id), asAdmin())).filter((row) => row.product.id === id)
    expect(rows.map((row) => row.qty)).toEqual([3, 1])
    expect(rows[0]).toMatchObject({
      reason: 'damaged',
      reasonLabel: 'Dañado',
      holder: { id: seller.id, fullName: 'Prueba shrh-seller' },
      product: { id, image: null },
    })
    expect(rows[0]!.requestId).toEqual(expect.any(String))
    expect(rows[0]!.createdAt).toEqual(expect.any(String))
    expect(rows[1]).toMatchObject({ reason: 'lost', reasonLabel: 'Se perdió' })

    const all = (await listShrinkages(ALL, asAdmin())).filter((row) => row.product.id === id)
    expect(all.map((row) => row.qty)).toEqual([3, 2, 1])
  })

  it('una fila sin motivo (anterior a T-25) trae reason y reasonLabel en null y requestId null', async () => {
    const id = await newProduct('sinmotivo', 3)
    await withTransaction((tx) => insertMovements(tx, [
      { productId: id, type: 'shrinkage', qty: -1, holderProfileId: null, createdBy: admin.id },
    ]))
    const rows = (await listShrinkages(ALL, asAdmin())).filter((row) => row.product.id === id)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ requestId: null, reason: null, reasonLabel: null, qty: 1, holder: null })
  })

  it('con scope «all» trae la bodega (holder null) y a los vendedores, también si ya están desactivados', async () => {
    const id = await newProduct('todas', 5, [[leaver, 4]])
    await shrink(id, 1, null)
    await shrink(id, 2, leaver.id)
    await db.update(profiles).set({ active: false }).where(eq(profiles.id, leaver.id))
    const rows = (await listShrinkages(ALL, asAdmin())).filter((row) => row.product.id === id)
    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.holder === null)).toMatchObject({ qty: 1 })
    expect(rows.find((row) => row.holder !== null)).toMatchObject({
      qty: 2,
      holder: { id: leaver.id, fullName: 'Prueba shrh-leaver' },
    })
  })

  it('incluye productos desactivados', async () => {
    const id = await newProduct('archivado', 0, [[seller, 3]])
    await shrink(id, 1, seller.id)
    await db.update(products).set({ active: false }).where(eq(products.id, id))
    const rows = (await listShrinkages(ofSeller(seller.id), asAdmin())).filter((row) => row.product.id === id)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.product.name).toContain('archivado')
  })

  it('con scope «seller» solo trae las de ese vendedor', async () => {
    const id = await newProduct('filtro', 5, [[seller, 4], [otherSeller, 4]])
    await shrink(id, 1, seller.id)
    await shrink(id, 1, otherSeller.id)
    await shrink(id, 1, null)
    const rows = mine(await listShrinkages(ofSeller(otherSeller.id), asAdmin()))
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.holder?.id === otherSeller.id)).toBe(true)
  })

  it('respeta el límite pedido y se queda con las más nuevas', async () => {
    const id = await newProduct('limite', 0, [[otherSeller, 9]])
    for (const qty of [1, 2, 3]) await shrink(id, qty, otherSeller.id)
    const rows = await listShrinkages(ofSeller(otherSeller.id, 2), asAdmin())
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.qty)).toEqual([3, 2])
    expect(await listShrinkages({ scope: 'all', limit: 1 }, asAdmin())).toHaveLength(1)
  })

  it('los límites de la API son 50 para el historial general y 20 para el del vendedor', () => {
    expect(SHRINKAGE_HISTORY_LIMIT).toBe(50)
    expect(SELLER_SHRINKAGE_HISTORY_LIMIT).toBe(20)
  })

  it('403 si quien consulta es un vendedor', async () => {
    const asSeller = { userId: seller.id, role: 'vendedor' }
    await expect(listShrinkages(ALL, asSeller)).rejects.toMatchObject({ code: 'forbidden' })
    await expect(listShrinkages(ofSeller(seller.id), asSeller)).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('404 con un vendedor desactivado, un administrador o un UUID inexistente', async () => {
    for (const id of [inactiveSeller.id, leaver.id, admin.id, randomUUID()]) {
      await expect(listShrinkages(ofSeller(id), asAdmin())).rejects.toMatchObject({ code: 'not_found' })
    }
  })
})
