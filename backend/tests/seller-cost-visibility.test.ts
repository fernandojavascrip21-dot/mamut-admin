import { randomUUID } from 'node:crypto'
import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as cutsRoute } from '@api/cuts/route'
import { GET as fractionsOptionsRoute } from '@api/fractions/options/route'
import { GET as fractionsListRoute, POST as fractionsCreateRoute } from '@api/fractions/route'
import { GET as meRoute } from '@api/me/route'
import { GET as ownStockRoute } from '@api/me/stock/route'
import { GET as productsListRoute, POST as productsCreateRoute } from '@api/products/route'
import { POST as purchasesCreateRoute } from '@api/purchases/route'
import { GET as getSaleRoute } from '@api/sales/[requestId]/route'
import { GET as saleCatalogRoute } from '@api/sales/catalog/route'
import { POST as createSaleRoute } from '@api/sales/route'
import { GET as sellersListRoute, POST as sellersCreateRoute } from '@api/sellers/route'
import { GET as shrinkagesOptionsRoute } from '@api/shrinkages/options/route'
import { GET as shrinkagesListRoute, POST as shrinkagesCreateRoute } from '@api/shrinkages/route'
import { GET as stockRoute } from '@api/stock/route'
import { db, sql } from '@db/client'
import { products, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { insertMovements, setHolderPrices } from '@stock'
import { cleanupSales, cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

// RNF-04 (T-29): con sesión de vendedor ninguna respuesta trae costo de fábrica, costo con envío ni
// ganancia, salvo su propio corte (HU-20). Productos de prueba con prefijo propio para limpiarlos.
const PREFIX = 'test-seller-cost-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// Costos con decimales poco comunes, para que su texto no aparezca por casualidad en otra cifra.
const FACTORY_COST = '287.1234'
const SELLER_COST = '310.5678'
const FORBIDDEN_FIELDS = ['unitCost', 'unit_cost', 'unitCostWithShipping', 'factoryUnitCost', 'profit']
const FORBIDDEN_AMOUNTS = ['287.12', '310.56']

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

// Solo valida que el texto de una respuesta no traiga campos ni cifras de costo o ganancia.
function expectNoCosts(text: string, where: string) {
  for (const forbidden of [...FORBIDDEN_FIELDS, ...FORBIDDEN_AMOUNTS]) {
    expect(text, `${where} no debe traer «${forbidden}»`).not.toContain(forbidden)
  }
}

describe.skipIf(!hasServiceKey)('El vendedor no ve costos ni ganancia fuera de su corte (T-29, con cuentas reales)', () => {
  let admin: TestUser
  let seller: TestUser
  let otherSeller: TestUser
  let ownProduct: number
  let otherProduct: number
  let ownProductName: string
  let otherProductName: string
  const ownRequestId = randomUUID()

  const authed = (token: string, init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init.body ? { 'content-type': 'application/json' } : {}) },
  })
  const url = (path: string) => `http://api.test${path}`

  // Producto con `qty` piezas en manos del vendedor, con su precio y su costo con envío propios.
  const productFor = async (label: string, holder: TestUser) => {
    const name = productName(label)
    const [product] = await db.insert(products).values({ name, price: '450', unitCost: FACTORY_COST }).returning()
    const productId = product!.id
    await withTransaction(async (tx) => {
      await insertMovements(tx, [
        { productId, type: 'initial', qty: 10, holderProfileId: null, createdBy: admin.id },
        { productId, type: 'delivery', qty: -5, holderProfileId: null, createdBy: admin.id },
        { productId, type: 'delivery', qty: 5, holderProfileId: holder.id, createdBy: admin.id },
      ])
      await setHolderPrices(tx, holder.id, productId, { unitPrice: '520', unitCostWithShipping: SELLER_COST })
    })
    return { productId, name }
  }

  const sell = (holder: TestUser, productId: number, requestId: string) =>
    createSaleRoute(
      new Request(url('/api/sales'), authed(holder.token, {
        method: 'POST',
        body: JSON.stringify({ requestId, lines: [{ productId, qty: 1 }] }),
      })),
      undefined,
    )

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    admin = await createTestUser('t29-admin', { role: 'admin' })
    seller = await createTestUser('t29-luis', { role: 'vendedor' })
    otherSeller = await createTestUser('t29-otro', { role: 'vendedor' })
    ;({ productId: ownProduct, name: ownProductName } = await productFor('propio', seller))
    ;({ productId: otherProduct, name: otherProductName } = await productFor('ajeno', otherSeller))
    expect((await sell(seller, ownProduct, ownRequestId)).status).toBe(201)
    expect((await sell(otherSeller, otherProduct, randomUUID())).status).toBe(201)
  }, 60_000)

  afterAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('«Mi stock», la sesión y la venta (crear, repetir y consultar) no traen costos ni ganancia (criterio 2)', async () => {
    const me = await meRoute(new Request(url('/api/me'), authed(seller.token)), undefined)
    expect(me.status).toBe(200)
    expectNoCosts(await me.text(), 'GET /api/me')

    const stock = await ownStockRoute(new Request(url('/api/me/stock?includeSoldOut=true'), authed(seller.token)), undefined)
    expect(stock.status).toBe(200)
    expectNoCosts(await stock.text(), 'GET /api/me/stock')

    const created = await sell(seller, ownProduct, randomUUID())
    expect(created.status).toBe(201)
    expectNoCosts(await created.text(), 'POST /api/sales')

    const replay = await sell(seller, ownProduct, ownRequestId)
    expect(replay.status).toBe(200)
    expectNoCosts(await replay.text(), 'POST /api/sales (repetición)')

    const fetched = await getSaleRoute(
      new Request(url(`/api/sales/${ownRequestId}`), authed(seller.token)),
      { params: Promise.resolve({ requestId: ownRequestId }) },
    )
    expect(fetched.status).toBe(200)
    expectNoCosts(await fetched.text(), 'GET /api/sales/[requestId]')
  })

  it('su corte sí trae costo y ganancia, pero solo de sus propias ventas (excepción de HU-20)', async () => {
    const res = await cutsRoute(new Request(url('/api/cuts'), authed(seller.token)), undefined)
    expect(res.status).toBe(200)
    const text = await res.text()
    const { cut } = JSON.parse(text)
    expect(cut.totals).toHaveProperty('cost')
    expect(cut.totals).toHaveProperty('profit')
    expect(text).toContain(ownProductName)
    expect(text).not.toContain(otherProductName)
    expect(text).not.toContain(otherSeller.id)
    // Su costo es el costo con envío; el costo de fábrica nunca llega a un vendedor.
    expect(text).not.toContain('factoryUnitCost')
    expect(text).not.toContain(FACTORY_COST)
  })

  it('pedir el corte de otro titular, el corte para casa o el del negocio da 403 (criterio 3)', async () => {
    const queries = [
      `?holderId=${otherSeller.id}`,
      `?holderId=${admin.id}`,
      '?type=home',
      `?type=home&holderId=${seller.id}`,
      '?type=home&scope=business',
    ]
    for (const query of queries) {
      const res = await cutsRoute(new Request(url(`/api/cuts${query}`), authed(seller.token)), undefined)
      expect(res.status, query).toBe(403)
    }
  })

  it('la venta de otro vendedor no se puede consultar (404, sin revelar que existe)', async () => {
    const foreign = randomUUID()
    expect((await sell(otherSeller, otherProduct, foreign)).status).toBe(201)
    const res = await getSaleRoute(
      new Request(url(`/api/sales/${foreign}`), authed(seller.token)),
      { params: Promise.resolve({ requestId: foreign }) },
    )
    expect(res.status).toBe(404)
  })

  it('un vendedor no puede dejarle ventas a otro titular ni a la bodega (403)', async () => {
    for (const holderId of [otherSeller.id, null]) {
      const res = await createSaleRoute(
        new Request(url('/api/sales'), authed(seller.token, {
          method: 'POST',
          body: JSON.stringify({ requestId: randomUUID(), holderId, lines: [{ productId: ownProduct, qty: 1 }] }),
        })),
        undefined,
      )
      expect(res.status, String(holderId)).toBe(403)
    }
  })

  // Rutas de administrador que traen costos: un vendedor recibe 403 antes de leer el cuerpo.
  const adminRoutes: [string, string, (request: Request, ctx: undefined) => Promise<Response>, string?][] = [
    ['GET /api/products', 'GET', productsListRoute],
    ['POST /api/products', 'POST', productsCreateRoute, '{}'],
    ['GET /api/stock', 'GET', stockRoute],
    ['GET /api/sellers', 'GET', sellersListRoute],
    ['POST /api/sellers', 'POST', sellersCreateRoute, '{}'],
    ['GET /api/sales/catalog', 'GET', saleCatalogRoute],
    ['POST /api/purchases', 'POST', purchasesCreateRoute, '{}'],
    ['GET /api/fractions', 'GET', fractionsListRoute],
    ['POST /api/fractions', 'POST', fractionsCreateRoute, '{}'],
    ['GET /api/fractions/options', 'GET', fractionsOptionsRoute],
    ['GET /api/shrinkages', 'GET', shrinkagesListRoute],
    ['POST /api/shrinkages', 'POST', shrinkagesCreateRoute, '{}'],
    ['GET /api/shrinkages/options', 'GET', shrinkagesOptionsRoute],
  ]

  it.each(adminRoutes)('%s responde 403 a un vendedor (criterio 3)', async (label, method, route, body) => {
    const path = label.split(' ')[1]!
    const res = await route(new Request(url(path), authed(seller.token, { method, ...(body ? { body } : {}) })), undefined)
    expect(res.status, label).toBe(403)
    expectNoCosts(await res.text(), label)
  })
})
