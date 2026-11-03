import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as ownStockRoute } from '@api/me/stock/route'
import { db, sql } from '@db/client'
import { products, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { insertMovements, setHolderPrices, type NewStockMovement } from '@stock'
import { cleanupTestData, createTestClient, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

// Productos de prueba con prefijo propio, para limpiarlos sin tocar el catálogo (como HU-13).
const PREFIX = 'test-own-stock-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

const req = (token?: string) =>
  new Request('http://api.test/api/me/stock', { method: 'GET', headers: token ? { authorization: `Bearer ${token}` } : {} })

interface OwnStockBody {
  total: number
  products: { productId: number; name: string; image: string | null; units: number; price: string }[]
}

// Los movimientos se borran del más nuevo al más viejo (el trigger revierte cada uno); después
// vendor_stock (ya en 0) y los productos. Va antes de cleanupTestData, porque vendor_stock apunta a
// los perfiles de prueba con FK `restrict`.
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

describe.skipIf(!hasServiceKey)('Mi stock del vendedor (HU-14, con cuentas reales)', () => {
  let admin: TestUser
  let clientUser: TestUser
  let seller: TestUser
  let otherSeller: TestUser
  let emptySeller: TestUser
  let own: number
  let general: number
  let archived: number
  let withdrawn: number
  let others: number

  const move = (rows: Omit<NewStockMovement, 'createdBy'>[]) =>
    withTransaction((tx) => insertMovements(tx, rows.map((row) => ({ ...row, createdBy: admin.id }))))

  // Entrega de bodega a vendedor: dos filas en la misma transacción (spec T-07 §3).
  const deliver = (productId: number, holder: string, qty: number) =>
    move([
      { productId, type: 'delivery', qty: -qty, holderProfileId: null },
      { productId, type: 'delivery', qty, holderProfileId: holder },
    ])

  // Retiro: el vendedor devuelve a la bodega; vendor_stock conserva su fila y su precio.
  const takeBack = (productId: number, holder: string, qty: number) =>
    move([
      { productId, type: 'return', qty, holderProfileId: null },
      { productId, type: 'return', qty: -qty, holderProfileId: holder },
    ])

  const newProduct = async (label: string, opts: { initial: number; archived?: boolean; image?: string; price?: string }) => {
    const [product] = await db.insert(products)
      .values({ name: productName(label), price: opts.price ?? '480', unitCost: '200', image: opts.image ?? '', active: !opts.archived })
      .returning()
    await move([{ productId: product!.id, type: 'initial', qty: opts.initial, holderProfileId: null }])
    return product!.id
  }

  const stockOf = async (user: TestUser): Promise<OwnStockBody> => {
    const res = await ownStockRoute(req(user.token), undefined)
    expect(res.status).toBe(200)
    return res.json()
  }

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    const clientId = (await createTestClient('gym')).id
    admin = await createTestUser('hu14-admin', { role: 'admin' })
    clientUser = await createTestUser('hu14-client', { role: 'client', clientId })
    seller = await createTestUser('hu14-victor', { role: 'vendedor' })
    otherSeller = await createTestUser('hu14-otro', { role: 'vendedor' })
    emptySeller = await createTestUser('hu14-vacio', { role: 'vendedor' })

    // Con precio propio (500) y costo con envío: ninguno de los dos costos debe llegar al vendedor.
    own = await newProduct('propio', { initial: 10, image: 'https://example.com/propio.jpg', price: '471' })
    await deliver(own, seller.id, 6)
    await withTransaction((tx) => setHolderPrices(tx, seller.id, own, { unitPrice: '500', unitCostWithShipping: '310' }))
    // Sin precio propio: usa el general.
    general = await newProduct('general', { initial: 5, price: '350' })
    await deliver(general, seller.id, 2)
    archived = await newProduct('archivado', { initial: 4, archived: true })
    await deliver(archived, seller.id, 3)
    withdrawn = await newProduct('retirado', { initial: 3 })
    await deliver(withdrawn, seller.id, 3)
    await withTransaction((tx) => setHolderPrices(tx, seller.id, withdrawn, { unitPrice: '999', unitCostWithShipping: null }))
    await takeBack(withdrawn, seller.id, 3)
    others = await newProduct('ajeno', { initial: 8 })
    await deliver(others, otherSeller.id, 7)
  }, 60_000)

  afterAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('con 6 piezas dejadas y precio propio sale «units: 6» con ese precio (criterio 2)', async () => {
    const body = await stockOf(seller)
    expect(body.products.find((p) => p.productId === own)).toEqual({
      productId: own,
      name: expect.stringContaining('propio'),
      image: 'https://example.com/propio.jpg',
      units: 6,
      price: '500.00',
    })
  })

  it('sin precio propio sale el precio general (criterio 3)', async () => {
    const line = (await stockOf(seller)).products.find((p) => p.productId === general)
    expect(line).toMatchObject({ units: 2, price: '350.00', image: null })
  })

  it('cada producto trae solo productId, name, image, units y price, sin costos (criterio 4)', async () => {
    const res = await ownStockRoute(req(seller.token), undefined)
    const text = await res.clone().text()
    const body: OwnStockBody = await res.json()
    expect(body.products.length).toBeGreaterThan(0)
    for (const product of body.products) {
      expect(Object.keys(product).sort()).toEqual(['image', 'name', 'price', 'productId', 'units'])
    }
    expect(Object.keys(body).sort()).toEqual(['products', 'total'])
    for (const forbidden of ['unitCost', 'unitCostWithShipping', 'unit_cost', 'profit', 'unitPrice']) {
      expect(text).not.toContain(forbidden)
    }
    // Ni el costo con envío (310) ni el precio general (471) de un producto con precio propio.
    expect(text).not.toContain('310')
    expect(text).not.toContain('471')
  })

  it('un producto retirado por completo sale de la lista y no suma, y la fila conserva su precio', async () => {
    const body = await stockOf(seller)
    expect(body.products.some((p) => p.productId === withdrawn)).toBe(false)
    const [held] = await db.select().from(vendorStock).where(eq(vendorStock.productId, withdrawn))
    expect(held).toMatchObject({ qty: 0, unitPrice: '999.00' })
    expect(body.total).toBe(6 + 2 + 3)
  })

  it('un producto archivado con piezas sale', async () => {
    expect((await stockOf(seller)).products.find((p) => p.productId === archived)).toMatchObject({ units: 3 })
  })

  it('cada vendedor ve solo lo suyo', async () => {
    const mine = await stockOf(seller)
    const theirs = await stockOf(otherSeller)
    expect(mine.products.some((p) => p.productId === others)).toBe(false)
    expect(theirs.products.map((p) => p.productId)).toEqual([others])
    expect(theirs.total).toBe(7)
  })

  it('el total es la suma de las piezas y los productos salen por nombre', async () => {
    const body = await stockOf(seller)
    expect(body.total).toBe(body.products.reduce((sum, p) => sum + p.units, 0))
    expect(body.products.map((p) => p.name)).toEqual([...body.products.map((p) => p.name)].sort())
  })

  it('un vendedor sin piezas responde total 0 y lista vacía', async () => {
    expect(await stockOf(emptySeller)).toEqual({ total: 0, products: [] })
  })

  it('responde 403 a un administrador y a un client, y 401 sin sesión', async () => {
    expect((await ownStockRoute(req(admin.token), undefined)).status).toBe(403)
    expect((await ownStockRoute(req(clientUser.token), undefined)).status).toBe(403)
    expect((await ownStockRoute(req(), undefined)).status).toBe(401)
  })
})
