import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as stockRoute } from '@api/stock/route'
import { db, sql } from '@db/client'
import { products, profiles, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { insertMovements, type NewStockMovement } from '@stock'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

// Productos de prueba con prefijo propio, para limpiarlos sin tocar el catálogo (como T-07).
const PREFIX = 'test-stock-overview-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

const req = (token?: string) =>
  new Request('http://api.test/api/stock', { method: 'GET', headers: token ? { authorization: `Bearer ${token}` } : {} })

interface Overview {
  warehouse: number
  lowStock: { productId: number; name: string; holder: { id: string; fullName: string } | null; units: number; stockLevel: string }[]
  sellers: { id: string; fullName: string; units: number }[]
  inactiveSellers: number
  total: number
  products: {
    productId: number
    name: string
    image: string | null
    warehouse: number
    warehouseLevel: string
    sellers: { sellerId: string; units: number; stockLevel: string }[]
    inactiveSellers: number
    total: number
  }[]
}

// Los movimientos se borran del más nuevo al más viejo (el trigger revierte cada uno); después
// vendor_stock (ya en 0) y los productos. Va antes de cleanupTestData, porque vendor_stock
// apunta a los perfiles de prueba con FK `restrict`.
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

describe.skipIf(!hasServiceKey)('Stock general (HU-13, con cuentas reales)', () => {
  let admin: TestUser
  let seller: TestUser
  let leavingSeller: TestUser
  let lowSeller: TestUser
  let few: number
  let whey: number
  let archived: number
  let empty: number

  const move = (rows: Omit<NewStockMovement, 'createdBy'>[]) =>
    withTransaction((tx) => insertMovements(tx, rows.map((row) => ({ ...row, createdBy: admin.id }))))

  // Entrega de bodega a vendedor: dos filas en la misma transacción (spec T-07 §3).
  const deliver = (productId: number, holder: string, qty: number) =>
    move([
      { productId, type: 'delivery', qty: -qty, holderProfileId: null },
      { productId, type: 'delivery', qty, holderProfileId: holder },
    ])

  const newProduct = async (label: string, opts: { initial?: number; archived?: boolean; image?: string } = {}) => {
    const [product] = await db.insert(products)
      .values({ name: productName(label), price: '100', unitCost: '50', image: opts.image ?? '', active: !opts.archived })
      .returning()
    if (opts.initial) await move([{ productId: product!.id, type: 'initial', qty: opts.initial, holderProfileId: null }])
    return product!.id
  }

  const overview = async (): Promise<Overview> => {
    const res = await stockRoute(req(admin.token), undefined)
    expect(res.status).toBe(200)
    return res.json()
  }

  // Invariantes de la spec §3, sobre toda la respuesta (incluye lo que haya en la base local).
  const expectInvariants = (body: Overview) => {
    for (const product of body.products) {
      const sellers = product.sellers.reduce((sum, s) => sum + s.units, 0)
      expect(product.total, product.name).toBe(product.warehouse + sellers + product.inactiveSellers)
      expect(product.total, product.name).toBeGreaterThan(0)
    }
    const sellers = body.sellers.reduce((sum, s) => sum + s.units, 0)
    expect(body.total).toBe(body.warehouse + sellers + body.inactiveSellers)
    expect(body.total).toBe(body.products.reduce((sum, p) => sum + p.total, 0))
  }

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    admin = await createTestUser('hu13-admin', { role: 'admin' })
    seller = await createTestUser('hu13-luis', { role: 'vendedor' })
    leavingSeller = await createTestUser('hu13-baja', { role: 'vendedor' })

    whey = await newProduct('whey', { initial: 10, image: 'https://example.com/whey.jpg' })
    await deliver(whey, seller.id, 6)
    archived = await newProduct('archivado', { initial: 5, archived: true })
    empty = await newProduct('vacio')
    // 1 pieza en bodega y 2 con un vendedor: dos avisos del mismo producto (HU-18).
    lowSeller = await createTestUser('hu18-poco', { role: 'vendedor' })
    few = await newProduct('poco', { initial: 3 })
    await deliver(few, lowSeller.id, 2)
  }, 60_000)

  afterAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('un producto con 4 en bodega y 6 con un vendedor suma 10 (criterio 2)', async () => {
    const body = await overview()
    expect(body.products.find((p) => p.productId === whey)).toEqual({
      productId: whey,
      name: expect.stringContaining('whey'),
      image: 'https://example.com/whey.jpg',
      parentProductId: null,
      warehouse: 4,
      warehouseLevel: 'ok',
      sellers: [{ sellerId: seller.id, units: 6, stockLevel: 'ok' }],
      inactiveSellers: 0,
      total: 10,
    })
    expect(body.sellers.find((s) => s.id === seller.id)).toEqual({ id: seller.id, fullName: 'Prueba hu13-luis', units: 6 })
    expectInvariants(body)
  })

  it('lista a todos los vendedores activos, también con 0 piezas, y no al administrador', async () => {
    const body = await overview()
    expect(body.sellers.find((s) => s.id === leavingSeller.id)?.units).toBe(0)
    expect(body.sellers.some((s) => s.id === admin.id)).toBe(false)
    const names = body.sellers.map((s) => s.fullName)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })))
  })

  it('un producto archivado con piezas sale y uno con 0 en todas partes no', async () => {
    const body = await overview()
    expect(body.products.find((p) => p.productId === archived)).toMatchObject({ warehouse: 5, total: 5, image: null })
    expect(body.products.some((p) => p.productId === empty)).toBe(false)
  })

  it('los productos salen por nombre', async () => {
    const names = (await overview()).products.map((p) => p.name)
    const mine = names.filter((n) => n.startsWith(PREFIX))
    expect(mine).toEqual([...mine].sort())
    expect(mine).toHaveLength(3)
  })

  it('las piezas de un vendedor desactivado suman como «inactivos», sin su nombre', async () => {
    await deliver(whey, leavingSeller.id, 2)
    const before = await overview()
    expect(before.products.find((p) => p.productId === whey)).toMatchObject({ warehouse: 2, total: 10 })
    expect(before.sellers.find((s) => s.id === leavingSeller.id)?.units).toBe(2)

    await db.update(profiles).set({ active: false }).where(eq(profiles.id, leavingSeller.id))
    const after = await overview()

    expect(after.sellers.some((s) => s.id === leavingSeller.id)).toBe(false)
    const row = after.products.find((p) => p.productId === whey)!
    expect(row).toMatchObject({ warehouse: 2, inactiveSellers: 2, total: 10 })
    expect(row.sellers).toEqual([{ sellerId: seller.id, units: 6, stockLevel: 'ok' }])
    expect(JSON.stringify(after)).not.toContain(leavingSeller.id)
    expect(after.total).toBe(before.total)
    expectInvariants(after)
  })

  it('lowStock avisa del mismo producto en la bodega y con el vendedor, con el nombre del titular (HU-18)', async () => {
    const body = await overview()
    expect(body.products.find((p) => p.productId === few)).toMatchObject({
      warehouse: 1,
      warehouseLevel: 'low',
      sellers: [{ sellerId: lowSeller.id, units: 2, stockLevel: 'low' }],
    })
    const alerts = body.lowStock.filter((a) => a.productId === few)
    expect(alerts).toHaveLength(2)
    expect(alerts).toContainEqual(expect.objectContaining({ holder: null, units: 1, stockLevel: 'low' }))
    expect(alerts).toContainEqual(expect.objectContaining({
      holder: { id: lowSeller.id, fullName: 'Prueba hu18-poco' }, units: 2, stockLevel: 'low',
    }))
  })

  it('lowStock incluye un producto activo sin piezas como «out» y ni el archivado', async () => {
    const { lowStock } = await overview()
    expect(lowStock.find((a) => a.productId === empty)).toMatchObject({ holder: null, units: 0, stockLevel: 'out' })
    expect(lowStock.some((a) => a.productId === archived)).toBe(false)
  })

  it('lowStock pone los agotados primero', async () => {
    const levels = (await overview()).lowStock.map((a) => a.stockLevel)
    expect(levels.slice(levels.indexOf('low')).includes('out')).toBe(false)
  })

  it('responde 403 a un vendedor y 401 sin sesión', async () => {
    expect((await stockRoute(req(seller.token), undefined)).status).toBe(403)
    expect((await stockRoute(req(), undefined)).status).toBe(401)
  })
})
