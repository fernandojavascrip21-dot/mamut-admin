import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, sql } from '@db/client'
import { products, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { insertMovements, lowStockLines, stockLevelOf, stockOfHolder, stockOfWarehouse, type NewStockMovement } from '@stock'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-levels-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

describe('stockLevelOf (HU-18)', () => {
  it('0 es «out»; 1 y 2 son «low»; 3 o más es «ok»', () => {
    expect(stockLevelOf(0)).toBe('out')
    expect(stockLevelOf(1)).toBe('low')
    expect(stockLevelOf(2)).toBe('low')
    expect(stockLevelOf(3)).toBe('ok')
    expect(stockLevelOf(40)).toBe('ok')
  })

  it('0 con `withdrawn` es «ok»: se le retiró todo y no hay nada que resurtir', () => {
    expect(stockLevelOf(0, { withdrawn: true })).toBe('ok')
    expect(stockLevelOf(2, { withdrawn: true })).toBe('low')
  })
})

// Los movimientos se borran del más nuevo al más viejo (el trigger revierte cada uno); luego
// vendor_stock y los productos. Va antes de cleanupTestData: vendor_stock apunta a los perfiles.
async function cleanupStock() {
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

describe.skipIf(!hasServiceKey)('Avisos de baja existencia (HU-18, con cuentas reales)', () => {
  let admin: TestUser
  let seller: TestUser
  let otherSeller: TestUser
  let inactiveSeller: TestUser
  const ids: Record<string, number> = {}

  const move = (rows: Omit<NewStockMovement, 'createdBy'>[]) =>
    withTransaction((tx) => insertMovements(tx, rows.map((row) => ({ ...row, createdBy: admin.id }))))

  const deliver = (productId: number, holder: string, qty: number) =>
    move([
      { productId, type: 'delivery', qty: -qty, holderProfileId: null },
      { productId, type: 'delivery', qty, holderProfileId: holder },
    ])

  const sell = (productId: number, holder: string, qty: number) =>
    move([{ productId, type: 'direct_sale', qty: -qty, holderProfileId: holder }])

  const takeBack = (productId: number, holder: string, qty: number) =>
    move([
      { productId, type: 'return', qty, holderProfileId: null },
      { productId, type: 'return', qty: -qty, holderProfileId: holder },
    ])

  const newProduct = async (label: string, initial: number, archived = false) => {
    const [product] = await db.insert(products)
      .values({ name: productName(label), price: '480', unitCost: '200', image: '', active: !archived })
      .returning()
    if (initial > 0) await move([{ productId: product!.id, type: 'initial', qty: initial, holderProfileId: null }])
    ids[label] = product!.id
    return product!.id
  }

  // Solo las líneas de los productos de esta prueba: la base trae también el catálogo del seed.
  const mine = async (holder?: string) =>
    (await lowStockLines(holder)).filter((line) => line.name.startsWith(PREFIX))

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    admin = await createTestUser('hu18-admin', { role: 'admin' })
    seller = await createTestUser('hu18-victor', { role: 'vendedor' })
    otherSeller = await createTestUser('hu18-otro', { role: 'vendedor' })
    inactiveSeller = await createTestUser('hu18-baja', { role: 'vendedor', active: false })

    await newProduct('b0', 0)
    await newProduct('b1', 1)
    await newProduct('b2', 2)
    await newProduct('b3', 3)
    await newProduct('archivado', 1, true)

    // Vendedor: 1 pieza (low), vendido hasta 0 (out), retirado hasta 0 (no sale) y 5 (ok).
    const low = await newProduct('v-low', 10)
    await deliver(low, seller.id, 1)
    const sold = await newProduct('v-vendido', 10)
    await deliver(sold, seller.id, 3)
    await sell(sold, seller.id, 3)
    const back = await newProduct('v-retirado', 10)
    await deliver(back, seller.id, 3)
    await takeBack(back, seller.id, 3)
    const fine = await newProduct('v-ok', 10)
    await deliver(fine, seller.id, 5)

    // Otro vendedor con 2 piezas, y un vendedor desactivado con 1.
    const other = await newProduct('o-low', 10)
    await deliver(other, otherSeller.id, 2)
    const gone = await newProduct('i-low', 10)
    await deliver(gone, inactiveSeller.id, 1)
  }, 60_000)

  afterAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('la bodega avisa con 0, 1 y 2 piezas, no con 3, y no incluye archivados', async () => {
    const warehouse = (await mine()).filter((line) => line.holderProfileId === null)
    const byId = new Map(warehouse.map((line) => [line.productId, line]))
    expect(byId.get(ids.b0!)).toMatchObject({ units: 0, stockLevel: 'out' })
    expect(byId.get(ids.b1!)).toMatchObject({ units: 1, stockLevel: 'low' })
    expect(byId.get(ids.b2!)).toMatchObject({ units: 2, stockLevel: 'low' })
    expect(byId.has(ids.b3!)).toBe(false)
    expect(byId.has(ids.archivado!)).toBe(false)
  })

  it('un vendedor con 1 pieza avisa; con 5 no', async () => {
    const lines = await mine(seller.id)
    expect(lines.find((line) => line.productId === ids['v-low'])).toMatchObject({ units: 1, stockLevel: 'low', holderProfileId: seller.id })
    expect(lines.some((line) => line.productId === ids['v-ok'])).toBe(false)
  })

  it('un vendedor en 0 tras vender avisa «out»; tras un retiro no avisa', async () => {
    const lines = await mine(seller.id)
    expect(lines.find((line) => line.productId === ids['v-vendido'])).toMatchObject({ units: 0, stockLevel: 'out' })
    expect(lines.some((line) => line.productId === ids['v-retirado'])).toBe(false)
  })

  it('stockOfHolder marca «ok» el 0 de un retiro y «out» el de una venta', async () => {
    const lines = await stockOfHolder(seller.id, { includeSoldOut: true })
    const level = (key: string) => lines.find((line) => line.productId === ids[key])?.stockLevel
    expect(level('v-retirado')).toBe('ok')
    expect(level('v-vendido')).toBe('out')
    expect(level('v-low')).toBe('low')
    expect(level('v-ok')).toBe('ok')
  })

  it('stockOfWarehouse trae el nivel de cada producto', async () => {
    const lines = await stockOfWarehouse()
    const level = (key: string) => lines.find((line) => line.productId === ids[key])?.stockLevel
    expect(level('b0')).toBe('out')
    expect(level('b2')).toBe('low')
    expect(level('b3')).toBe('ok')
  })

  it('sin argumento incluye a los vendedores activos; con un id, solo a ese vendedor', async () => {
    const all = await mine()
    expect(all.some((line) => line.holderProfileId === otherSeller.id)).toBe(true)
    expect(all.some((line) => line.holderProfileId === seller.id)).toBe(true)

    const onlyOther = await mine(otherSeller.id)
    expect(onlyOther.length).toBeGreaterThan(0)
    expect(onlyOther.every((line) => line.holderProfileId === otherSeller.id)).toBe(true)
  })

  it('un vendedor desactivado no genera avisos', async () => {
    expect((await mine()).some((line) => line.holderProfileId === inactiveSeller.id)).toBe(false)
    expect(await mine(inactiveSeller.id)).toEqual([])
  })

  it('ordena los agotados primero y luego por nombre', async () => {
    const levels = (await mine()).map((line) => line.stockLevel)
    const firstLow = levels.indexOf('low')
    expect(levels.slice(firstLow).includes('out')).toBe(false)
  })
})
