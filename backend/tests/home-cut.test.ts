import { randomUUID } from 'node:crypto'
import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as cutsRoute } from '@api/cuts/route'
import { getCashCut, getHomeCut } from '@cuts'
import { db, sql } from '@db/client'
import { directSales, products, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { toMinorUnits } from '@lib/money'
import { createSale } from '@sales'
import { insertMovements, setHolderPrices } from '@stock'
import { cleanupSales, cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

// Productos de prueba con prefijo propio, para limpiarlos sin tocar el catálogo.
const PREFIX = 'test-home-cut-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// Las ventas se borran primero (sus renglones apuntan a los productos con FK `restrict`); luego los
// movimientos del más nuevo al más viejo, vendor_stock y los productos.
async function cleanupStock() {
  await cleanupSales()
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

// Todas las llaves de un JSON, en cualquier nivel (para buscar las prohibidas).
const keysOf = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(keysOf)
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, inner]) => [key, ...keysOf(inner)])
  }
  return []
}

// `a + b = c` en centavos, sin flotantes.
const addsUp = (a: string, b: string, c: string) => toMinorUnits(a, 2) + toMinorUnits(b, 2) === toMinorUnits(c, 2)

describe.skipIf(!hasServiceKey)('Corte para casa (T-22, con cuentas reales)', () => {
  let admin: TestUser
  let seller: TestUser
  let inactiveSeller: TestUser
  const asAdmin = () => ({ userId: admin.id, role: 'admin' })
  const asSeller = () => ({ userId: seller.id, role: 'vendedor' })

  // Producto con costo de fábrica `unitCost` y `qty` piezas en manos del vendedor, con costo con
  // envío propio (`null` = sin él: el vendedor vende al costo de fábrica).
  const productWithSeller = async (label: string, qty: number, price: string, unitCost: string, unitCostWithShipping: string | null) => {
    const [product] = await db.insert(products).values({ name: productName(label), price, unitCost }).returning()
    const productId = product!.id
    await withTransaction(async (tx) => {
      await insertMovements(tx, [
        { productId, type: 'initial', qty, holderProfileId: null, createdBy: admin.id },
        { productId, type: 'delivery', qty: -qty, holderProfileId: null, createdBy: admin.id },
        { productId, type: 'delivery', qty, holderProfileId: seller.id, createdBy: admin.id },
      ])
      await setHolderPrices(tx, seller.id, productId, { unitPrice: null, unitCostWithShipping })
    })
    return productId
  }

  // Producto con `qty` piezas en la bodega.
  const warehouseProduct = async (label: string, qty: number, price: string, unitCost: string) => {
    const [product] = await db.insert(products).values({ name: productName(label), price, unitCost }).returning()
    await withTransaction((tx) => insertMovements(tx, [
      { productId: product!.id, type: 'initial', qty, holderProfileId: null, createdBy: admin.id },
    ]))
    return product!.id
  }

  // Registra una venta y fija su `sold_at` al mediodía (hora de México, UTC-6) de `date`. Cada caso
  // usa un día propio, para que sus cortes solo vean sus ventas.
  const sellOn = async (
    date: string, actor: { userId: string; role: string }, holderId: string | null,
    lines: { productId: number; qty: number }[],
  ) => {
    const { sale } = await createSale({ requestId: randomUUID(), holderId, lines }, actor)
    await db.update(directSales).set({ soldAt: `${date}T18:00:00Z` }).where(eq(directSales.id, sale.id))
    return sale.requestId
  }

  const homeCutOn = (date: string, holderId: string | undefined) =>
    getHomeCut({ holderId, period: 'day', date }, asAdmin())
  const pricesCutOn = (date: string, holderId: string | undefined) =>
    getCashCut({ holderId, period: 'day', date }, asAdmin())

  const getCut = (token: string, query: string) =>
    cutsRoute(new Request(`http://api.test/api/cuts${query}`, { headers: { authorization: `Bearer ${token}` } }), undefined)

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    admin = await createTestUser('t22-admin', { role: 'admin' })
    seller = await createTestUser('t22-luis', { role: 'vendedor' })
    inactiveSeller = await createTestUser('t22-inactivo', { role: 'vendedor', active: false })
  }, 60_000)

  afterAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('cifras: 2 piezas a 920 con costo con envío 700 y fábrica 600 dan 1840.00, 1200.00, 640.00 y 200.00', async () => {
    const date = '2019-03-01'
    const productId = await productWithSeller('cifras', 5, '920', '600', '700')
    const requestId = await sellOn(date, asSeller(), seller.id, [{ productId, qty: 2 }])

    const cut = await homeCutOn(date, seller.id)
    expect(cut).toMatchObject({
      type: 'home',
      holder: { id: seller.id },
      period: { kind: 'day', from: date, to: date, timeZone: 'America/Mexico_City' },
    })
    expect(cut.totals).toEqual({
      salesCount: 1, units: 2, total: '1840.00', factoryCost: '1200.00', realProfit: '640.00', shippingCover: '200.00',
    })
    expect(cut.products).toEqual([{
      productId, name: expect.stringContaining('cifras'), image: null, unitPrice: '920.00', units: 2,
      total: '1840.00', factoryCost: '1200.00', realProfit: '640.00', shippingCover: '200.00',
    }])
    expect(cut.sales).toEqual([{
      requestId, soldAt: `${date}T18:00:00.000Z`, registeredByAdmin: false,
      soldBy: { id: seller.id, fullName: expect.any(String) },
      total: '1840.00', realProfit: '640.00', shippingCover: '200.00',
      lines: [{
        productId, name: expect.stringContaining('cifras'), qty: 2, unitPrice: '920.00', subtotal: '1840.00',
        unitCost: '700.0000', factoryUnitCost: '600.0000', realProfit: '640.00',
      }],
    }])
  })

  it('el costo de fábrica de 4 decimales se redondea una sola vez: 3 piezas a 0.3335 dan 1.00', async () => {
    const date = '2019-03-02'
    const productId = await productWithSeller('redondeo', 5, '2', '0.3335', null)
    await sellOn(date, asSeller(), seller.id, [{ productId, qty: 1 }])
    await sellOn(date, asSeller(), seller.id, [{ productId, qty: 2 }])

    const cut = await homeCutOn(date, seller.id)
    expect(cut.totals).toMatchObject({ units: 3, total: '6.00', factoryCost: '1.00', realProfit: '5.00' })
    expect(cut.products[0]).toMatchObject({ factoryCost: '1.00', realProfit: '5.00' })
  })

  it('mismas ventas que el corte con precios, y profit + shippingCover = realProfit al centavo (RF-30)', async () => {
    const date = '2019-03-03'
    const withShipping = await productWithSeller('mix-envio', 6, '920', '600', '700')
    const withoutShipping = await productWithSeller('mix-sin-envio', 6, '150', '99.9999', null)
    const fourDecimals = await productWithSeller('mix-cuatro', 9, '1', '0.3335', '0.5001')
    await sellOn(date, asSeller(), seller.id, [{ productId: withShipping, qty: 2 }, { productId: fourDecimals, qty: 3 }])
    await sellOn(date, asAdmin(), seller.id, [{ productId: withoutShipping, qty: 1 }, { productId: fourDecimals, qty: 2 }])
    await sellOn(date, asSeller(), seller.id, [{ productId: withShipping, qty: 1 }])

    const prices = await pricesCutOn(date, seller.id)
    const home = await homeCutOn(date, seller.id)

    expect(home.totals).toMatchObject({ salesCount: prices.totals.salesCount, units: prices.totals.units, total: prices.totals.total })
    expect(home.products.map(({ productId, unitPrice, units, total }) => ({ productId, unitPrice, units, total })))
      .toEqual(prices.products.map(({ productId, unitPrice, units, total }) => ({ productId, unitPrice, units, total })))
    expect(home.sales.map((sale) => sale.requestId)).toEqual(prices.sales.map((sale) => sale.requestId))

    expect(addsUp(prices.totals.profit, home.totals.shippingCover, home.totals.realProfit)).toBe(true)
    home.products.forEach((line, index) => {
      expect(addsUp(prices.products[index]!.profit, line.shippingCover, line.realProfit)).toBe(true)
    })

    // Sin costo con envío propio, el producto no suma a «para cubrir envíos».
    expect(home.products.find((line) => line.productId === withoutShipping)).toMatchObject({ shippingCover: '0.00' })
    // La venta que el administrador registró desde el stock del vendedor lleva la marca.
    expect(home.sales.map((sale) => sale.registeredByAdmin)).toEqual(prices.sales.map((sale) => sale.registeredByAdmin))
    expect(home.sales.some((sale) => sale.registeredByAdmin)).toBe(true)
  })

  it('sin holderId es el corte para casa de la bodega, sin «para cubrir envíos»', async () => {
    const date = '2019-03-04'
    const warehouse = await warehouseProduct('bodega', 5, '500', '312.5')
    const held = await productWithSeller('bodega-vendedor', 3, '920', '600', '700')
    await sellOn(date, asAdmin(), null, [{ productId: warehouse, qty: 2 }])
    await sellOn(date, asSeller(), seller.id, [{ productId: held, qty: 1 }])

    const cut = await homeCutOn(date, undefined)
    expect(cut.holder).toBeNull()
    expect(cut.totals).toEqual({
      salesCount: 1, units: 2, total: '1000.00', factoryCost: '625.00', realProfit: '375.00', shippingCover: '0.00',
    })
    expect(cut.products.map((line) => line.productId)).toEqual([warehouse])
    expect(cut.sales[0]).toMatchObject({ registeredByAdmin: false, shippingCover: '0.00' })
  })

  it('GET /api/cuts?type=home: 200 en la forma de §4 y sin las llaves cost ni profit', async () => {
    const date = '2019-03-05'
    const productId = await productWithSeller('ruta', 3, '920', '600', '700')
    await sellOn(date, asSeller(), seller.id, [{ productId, qty: 1 }])

    const res = await getCut(admin.token, `?type=home&holderId=${seller.id}&period=day&date=${date}`)
    expect(res.status).toBe(200)
    const { cut } = await res.json()
    expect(cut).toMatchObject({ type: 'home', holder: { id: seller.id }, totals: { shippingCover: '100.00' } })
    const keys = keysOf(cut)
    expect(keys).not.toContain('cost')
    expect(keys).not.toContain('profit')
    expect(keys).toEqual(expect.arrayContaining(['factoryCost', 'realProfit', 'shippingCover', 'factoryUnitCost']))
  })

  it('sin type, GET /api/cuts sigue siendo el corte con precios, con type "prices"', async () => {
    const res = await getCut(admin.token, `?holderId=${seller.id}&period=day&date=2019-03-05`)
    expect(res.status).toBe(200)
    const { cut } = await res.json()
    expect(cut.type).toBe('prices')
    expect(cut.totals).toHaveProperty('cost')
    expect(cut.totals).not.toHaveProperty('factoryCost')
  })

  it('un periodo sin ventas devuelve ceros y listas vacías, igual que el corte con precios', async () => {
    const res = await getCut(admin.token, `?type=home&holderId=${seller.id}&period=day&date=2001-01-01`)
    expect(res.status).toBe(200)
    const { cut } = await res.json()
    expect(cut.totals).toEqual({
      salesCount: 0, units: 0, total: '0.00', factoryCost: '0.00', realProfit: '0.00', shippingCover: '0.00',
    })
    expect(cut.products).toEqual([])
    expect(cut.sales).toEqual([])
  })

  it('el vendedor recibe 403 con type=home, con o sin holderId', async () => {
    expect((await getCut(seller.token, '?type=home')).status).toBe(403)
    expect((await getCut(seller.token, `?type=home&holderId=${seller.id}`)).status).toBe(403)
    await expect(getHomeCut({ holderId: undefined, period: 'day', date: undefined }, asSeller()))
      .rejects.toMatchObject({ status: 403 })
  })

  it('type inválido da 422; vendedor desactivado da 200; holderId que no es de un vendedor da 404', async () => {
    expect((await getCut(admin.token, '?type=otro')).status).toBe(422)
    expect((await getCut(admin.token, `?type=home&holderId=${inactiveSeller.id}`)).status).toBe(200)
    expect((await getCut(admin.token, `?type=home&holderId=${admin.id}`)).status).toBe(404)
  })
})
