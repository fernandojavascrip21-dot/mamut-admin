import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as getDeliveryRoute } from '@api/deliveries/[requestId]/route'
import { GET as historyRoute, POST as postDeliveryRoute } from '@api/sellers/[id]/deliveries/route'
import { GET as holdingRoute } from '@api/sellers/[id]/stock/[productId]/route'
import { GET as sellerDetailRoute } from '@api/sellers/[id]/route'
import { db, sql } from '@db/client'
import { products, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { insertMovements } from '@stock'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

// Productos de prueba con prefijo propio, para limpiarlos sin tocar el catálogo.
const PREFIX = 'test-deliveries-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

const headers = (token?: string): Record<string, string> =>
  token ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : {}
const sellerCtx = (id: string) => ({ params: Promise.resolve({ id }) })

// Los movimientos se borran del más nuevo al más viejo (el trigger revierte cada uno); después
// vendor_stock (ya en 0) y los productos. Va antes de cleanupTestData: vendor_stock apunta a los
// perfiles de prueba con FK `restrict`.
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

describe.skipIf(!hasServiceKey)('Dejar a vendedor (HU-11, con cuentas reales)', () => {
  let admin: TestUser
  let seller: TestUser
  let otherSeller: TestUser
  let inactiveSeller: TestUser

  const newProduct = async (label: string, qty = 10, opts: { archived?: boolean } = {}) => {
    const [product] = await db.insert(products)
      .values({ name: productName(label), price: '450', unitCost: '300', active: !opts.archived }).returning()
    if (qty > 0) {
      await withTransaction((tx) => insertMovements(tx, [
        { productId: product!.id, type: 'initial', qty, holderProfileId: null, createdBy: admin.id },
      ]))
    }
    return product!.id
  }

  const postAs = (token: string | undefined, sellerId: string, body: Record<string, unknown>) =>
    postDeliveryRoute(
      new Request('http://api.test/api/sellers/x/deliveries', { method: 'POST', headers: headers(token), body: JSON.stringify(body) }),
      sellerCtx(sellerId),
    )
  const post = (sellerId: string, body: Record<string, unknown>) => postAs(admin.token, sellerId, body)
  const deliver = (productId: number, qty: number, extra: Record<string, unknown> = {}, sellerId = seller.id) =>
    post(sellerId, { requestId: randomUUID(), productId, qty, unitPrice: null, unitCostWithShipping: null, ...extra })

  const stockOf = async (productId: number) => {
    const [product] = await db.select().from(products).where(eq(products.id, productId))
    const [held] = await db.select().from(vendorStock).where(eq(vendorStock.productId, productId))
    return { warehouse: product!.stock, seller: held?.qty ?? 0, held }
  }
  const countMovements = async (requestId: string) =>
    (await db.select().from(stockMovements).where(eq(stockMovements.requestId, requestId))).length

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    admin = await createTestUser('hu11-admin', { role: 'admin' })
    seller = await createTestUser('hu11-luis', { role: 'vendedor' })
    otherSeller = await createTestUser('hu11-otro', { role: 'vendedor' })
    inactiveSeller = await createTestUser('hu11-inactivo', { role: 'vendedor', active: false })
  }, 60_000)

  afterAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('deja piezas: dos movimientos con el mismo request_id y los saldos antes y después', async () => {
    const productId = await newProduct('basico')
    const requestId = randomUUID()
    const res = await post(seller.id, { requestId, productId, qty: 6, unitPrice: null, unitCostWithShipping: null })
    expect(res.status).toBe(201)
    const body = await res.json()

    expect(body).toMatchObject({
      requestId, qty: 6,
      seller: { id: seller.id, fullName: 'Prueba hu11-luis' },
      product: { id: productId, image: null, price: '450.00', unitCost: '300.0000' },
      unitPrice: null, unitCostWithShipping: null,
      warehouse: { before: 10, after: 4 },
      sellerStock: { before: 0, after: 6 },
    })
    const rows = await db.select().from(stockMovements).where(eq(stockMovements.requestId, requestId))
    expect(rows.map((row) => [row.type, row.qty, row.holderProfileId]).sort()).toEqual([
      ['delivery', -6, null],
      ['delivery', 6, seller.id],
    ].sort())
    expect(await stockOf(productId)).toMatchObject({ warehouse: 4, seller: 6 })
  })

  it('con precio y costo vacíos quedan en null; con valores se guardan y el precio general no cambia', async () => {
    const productId = await newProduct('precios')
    await deliver(productId, 1)
    expect((await stockOf(productId)).held).toMatchObject({ unitPrice: null, unitCostWithShipping: null })

    const res = await deliver(productId, 1, { unitPrice: '520', unitCostWithShipping: 310.5 })
    expect((await res.json())).toMatchObject({ unitPrice: '520.00', unitCostWithShipping: '310.5000' })
    expect((await stockOf(productId)).held).toMatchObject({ unitPrice: '520.00', unitCostWithShipping: '310.5000' })
    const [product] = await db.select().from(products).where(eq(products.id, productId))
    expect(product).toMatchObject({ price: '450.00', unitCost: '300.0000' })
  })

  it('una entrega nueva reemplaza los precios anteriores y vacío vuelve al general', async () => {
    const productId = await newProduct('reemplazo')
    await deliver(productId, 1, { unitPrice: '500', unitCostWithShipping: '310' })
    await deliver(productId, 1, { unitPrice: '480.50', unitCostWithShipping: '310' })
    expect((await stockOf(productId)).held).toMatchObject({ unitPrice: '480.50', unitCostWithShipping: '310.0000', qty: 2 })

    await deliver(productId, 1, { unitPrice: null, unitCostWithShipping: null })
    expect((await stockOf(productId)).held).toMatchObject({ unitPrice: null, unitCostWithShipping: null, qty: 3 })
  })

  it('más piezas que la bodega da 409 y no mueve nada', async () => {
    const productId = await newProduct('pocas', 3)
    const requestId = randomUUID()
    const res = await post(seller.id, { requestId, productId, qty: 4, unitPrice: null, unitCostWithShipping: null })
    expect(res.status).toBe(409)
    expect((await res.json()).error.message).toBe('No hay piezas suficientes')
    expect(await countMovements(requestId)).toBe(0)
    expect(await stockOf(productId)).toMatchObject({ warehouse: 3, seller: 0 })
  })

  it('rechaza con 422 piezas inválidas, montos inválidos y un requestId inválido', async () => {
    const productId = await newProduct('invalidos')
    const bad: Record<string, unknown>[] = [
      { qty: 0 }, { qty: -2 }, { qty: 1.5 }, { qty: '3' }, { qty: 3_000_000_000 },
      { unitPrice: '10.123' }, { unitPrice: '0' }, { unitPrice: '' }, { unitPrice: '100000000' }, { unitPrice: '1e2' },
      { unitCostWithShipping: '1.23456' }, { unitCostWithShipping: 0 }, { unitCostWithShipping: '1000000' },
      { requestId: 'no-es-uuid' }, { requestId: undefined }, { productId: 'x' },
    ]
    for (const override of bad) {
      const res = await deliver(productId, 1, override)
      expect(res.status, JSON.stringify(override)).toBe(422)
    }
    expect(await stockOf(productId)).toMatchObject({ warehouse: 10, seller: 0 })
  })

  it('responde 404 con un vendedor inválido, desactivado o administrador, y con un producto archivado o inexistente', async () => {
    const productId = await newProduct('404')
    const archived = await newProduct('archivado', 5, { archived: true })
    for (const id of ['no-es-uuid', '00000000-0000-4000-8000-000000000000', admin.id, inactiveSeller.id]) {
      expect((await deliver(productId, 1, {}, id)).status, id).toBe(404)
    }
    expect((await deliver(archived, 1)).status).toBe(404)
    expect((await deliver(999_999_999, 1)).status).toBe(404)
  })

  it('repetir el mismo requestId no duplica la entrega y responde 200', async () => {
    const productId = await newProduct('idempotente')
    const body = { requestId: randomUUID(), productId, qty: 5, unitPrice: '500', unitCostWithShipping: null }
    const first = await post(seller.id, body)
    const second = await post(seller.id, body)
    expect(first.status).toBe(201)
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual(await first.json())
    expect(await countMovements(body.requestId)).toBe(2)
    expect(await stockOf(productId)).toMatchObject({ warehouse: 5, seller: 5 })
  })

  it('dos peticiones iguales a la vez dejan un solo par de movimientos', async () => {
    const productId = await newProduct('simultaneo')
    const body = { requestId: randomUUID(), productId, qty: 2, unitPrice: null, unitCostWithShipping: null }
    const [a, b] = await Promise.all([post(seller.id, body), post(seller.id, body)])
    expect([a.status, b.status].sort()).toEqual([200, 201])
    expect(await countMovements(body.requestId)).toBe(2)
    expect(await stockOf(productId)).toMatchObject({ warehouse: 8, seller: 2 })
  })

  it('el mismo requestId con otros datos da 409 y no mueve nada', async () => {
    const productId = await newProduct('distinto')
    const requestId = randomUUID()
    await post(seller.id, { requestId, productId, qty: 2, unitPrice: null, unitCostWithShipping: null })
    const otherQty = await post(seller.id, { requestId, productId, qty: 3, unitPrice: null, unitCostWithShipping: null })
    const otherSellerRes = await post(otherSeller.id, { requestId, productId, qty: 2, unitPrice: null, unitCostWithShipping: null })
    expect(otherQty.status).toBe(409)
    expect(otherSellerRes.status).toBe(409)
    expect((await otherQty.json()).error.message).toContain('ya se registró con otros datos')
    expect(await stockOf(productId)).toMatchObject({ warehouse: 8, seller: 2 })
  })

  it('GET /api/deliveries/:requestId devuelve el resumen con los saldos de ese momento', async () => {
    const productId = await newProduct('resumen')
    const requestId = randomUUID()
    await post(seller.id, { requestId, productId, qty: 4, unitPrice: '500', unitCostWithShipping: null })
    await deliver(productId, 2) // una entrega posterior no cambia el resumen de la primera, salvo los precios vigentes

    const res = await getDeliveryRoute(
      new Request('http://api.test/api/deliveries/x', { headers: headers(admin.token) }),
      { params: Promise.resolve({ requestId }) },
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ qty: 4, warehouse: { before: 10, after: 6 }, sellerStock: { before: 0, after: 4 } })

    for (const id of ['no-es-uuid', randomUUID()]) {
      const missing = await getDeliveryRoute(
        new Request('http://api.test/api/deliveries/x', { headers: headers(admin.token) }),
        { params: Promise.resolve({ requestId: id }) },
      )
      expect(missing.status, id).toBe(404)
    }
  })

  it('el historial lista las entregas de la más nueva a la más vieja, sin las de otros', async () => {
    const first = await newProduct('hist-1')
    const second = await newProduct('hist-2')
    const lonely = await newProduct('hist-3')
    await deliver(first, 1, {}, otherSeller.id)
    await deliver(first, 2)
    const secondId = randomUUID()
    await post(seller.id, { requestId: secondId, productId: second, qty: 3, unitPrice: null, unitCostWithShipping: null })
    await deliver(lonely, 1, {}, otherSeller.id)

    const res = await historyRoute(
      new Request('http://api.test/api/sellers/x/deliveries', { headers: headers(admin.token) }),
      sellerCtx(seller.id),
    )
    expect(res.status).toBe(200)
    const rows: { requestId: string; productId: number; qty: number; createdAt: string }[] = await res.json()
    const mine = rows.filter((row) => [first, second, lonely].includes(row.productId)).slice(0, 2)
    expect(mine.map((row) => [row.productId, row.qty])).toEqual([[second, 3], [first, 2]])
    expect(mine[0]!.requestId).toBe(secondId)
    expect(rows.every((row) => row.productId !== lonely)).toBe(true)
  })

  it('GET /api/sellers/:id/stock/:productId trae piezas y precios, y 0 y null si no hay fila', async () => {
    const productId = await newProduct('holding')
    const get = (sellerId: string, product: string) =>
      holdingRoute(
        new Request('http://api.test/x', { headers: headers(admin.token) }),
        { params: Promise.resolve({ id: sellerId, productId: product }) },
      )

    expect(await (await get(seller.id, String(productId))).json())
      .toEqual({ units: 0, unitPrice: null, unitCostWithShipping: null })
    await deliver(productId, 2, { unitPrice: '500', unitCostWithShipping: '310' })
    expect(await (await get(seller.id, String(productId))).json())
      .toEqual({ units: 2, unitPrice: '500.00', unitCostWithShipping: '310.0000' })
    expect((await get(seller.id, '999999999')).status).toBe(404)
    expect((await get(inactiveSeller.id, String(productId))).status).toBe(404)
  })

  it('el detalle del vendedor incluye precios generales y propios de cada línea', async () => {
    const productId = await newProduct('detalle')
    await deliver(productId, 2, { unitPrice: '500', unitCostWithShipping: null })
    const res = await sellerDetailRoute(
      new Request('http://api.test/x', { headers: headers(admin.token) }),
      sellerCtx(seller.id),
    )
    const body = await res.json()
    expect(body.stock).toEqual(expect.arrayContaining([
      expect.objectContaining({
        productId, units: 2, warehouseUnits: 8, price: '450.00', unitCost: '300.0000', unitPrice: '500.00', unitCostWithShipping: null,
      }),
    ]))
  })

  it('los endpoints responden 403 a un vendedor y 401 sin token', async () => {
    const productId = await newProduct('permisos')
    const body = { requestId: randomUUID(), productId, qty: 1, unitPrice: null, unitCostWithShipping: null }
    const calls = (token?: string) => [
      postAs(token, seller.id, body),
      historyRoute(new Request('http://api.test/x', { headers: headers(token) }), sellerCtx(seller.id)),
      getDeliveryRoute(new Request('http://api.test/x', { headers: headers(token) }), { params: Promise.resolve({ requestId: randomUUID() }) }),
      holdingRoute(new Request('http://api.test/x', { headers: headers(token) }), { params: Promise.resolve({ id: seller.id, productId: String(productId) }) }),
    ]
    for (const res of await Promise.all(calls(seller.token))) expect(res.status).toBe(403)
    for (const res of await Promise.all(calls(undefined))) expect(res.status).toBe(401)
    expect(await countMovements(body.requestId)).toBe(0)
  })
})
