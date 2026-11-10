import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POST as postPurchaseRoute } from '@api/purchases/route'
import { GET as getPurchaseRoute } from '@api/purchases/[requestId]/route'
import { db } from '@db/client'
import { products, stockMovements, vendorStock } from '@db/schema'
import { createProduct } from '@products'
import { createPurchase, getPurchase, MAX_QTY, type CreatePurchaseInput } from '@purchases'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-pur-'
const productName = () => `${PREFIX}${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// Movimientos del más nuevo al más viejo (revierten saldos) y luego los productos de prueba.
async function cleanupPurchases() {
  const rows = await db.select({ id: products.id }).from(products).where(ilike(products.name, `${PREFIX}%`))
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return
  const movements = await db.select({ id: stockMovements.id }).from(stockMovements)
    .where(inArray(stockMovements.productId, ids)).orderBy(desc(stockMovements.id))
  for (const movement of movements) {
    await db.delete(stockMovements).where(eq(stockMovements.id, movement.id))
  }
  await db.delete(vendorStock).where(inArray(vendorStock.productId, ids))
  await db.update(products).set({ parentProductId: null }).where(inArray(products.id, ids))
  await db.delete(products).where(inArray(products.id, ids))
}

describe.skipIf(!hasServiceKey)('Entrada de producto a la bodega (HU-27, base real)', () => {
  let admin: TestUser
  let seller: TestUser

  const asAdmin = () => ({ userId: admin.id, role: 'admin' })

  // `warehouse` ≥ 1: el alta no admite un movimiento `initial` en 0.
  const newProduct = async (warehouse: number) => {
    const created = await createProduct({
      name: productName(),
      categoryId: null,
      price: '900.00',
      unitCost: '450.0000',
      initialQty: warehouse,
      fractionable: false,
      portionSize: null,
      image: null,
    }, admin.id)
    return created.id as number
  }

  const input = (productId: number, extra: Partial<CreatePurchaseInput> = {}): CreatePurchaseInput =>
    ({ requestId: randomUUID(), productId, qty: 5, ...extra })

  const warehouseOf = async (id: number) => (await db.select().from(products).where(eq(products.id, id)))[0]!.stock
  const purchaseRows = (id: number) =>
    db.select().from(stockMovements).where(eq(stockMovements.productId, id))
      .then((rows) => rows.filter((row) => row.type === 'purchase'))

  beforeAll(async () => {
    admin = await createTestUser('pur-admin', { role: 'admin' })
    seller = await createTestUser('pur-seller', { role: 'vendedor' })
  })
  afterAll(async () => {
    await cleanupPurchases()
    await cleanupTestData()
  })

  it('crea una fila purchase de bodega con qty > 0, sube el stock y devuelve antes → después', async () => {
    const id = await newProduct(3)
    const { purchase, replayed } = await createPurchase(input(id, { qty: 5 }), asAdmin())
    expect(replayed).toBe(false)
    expect(purchase.qty).toBe(5)
    expect(purchase.stock).toEqual({ before: 3, after: 8 })
    expect(purchase.product.id).toBe(id)
    expect(await warehouseOf(id)).toBe(8)
    const rows = await purchaseRows(id)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ qty: 5, holderProfileId: null, createdBy: admin.id })
  })

  it('una bolsita (con parentProductId) también recibe entradas', async () => {
    const parent = await newProduct(1)
    const pouch = await newProduct(1)
    await db.update(products).set({ parentProductId: parent }).where(eq(products.id, pouch))
    const { purchase } = await createPurchase(input(pouch, { qty: 4 }), asAdmin())
    expect(purchase.stock).toEqual({ before: 1, after: 5 })
    expect(await warehouseOf(pouch)).toBe(5)
  })

  it('422 con piezas en 0, negativas, decimales o demasiado grandes, sin filas nuevas', async () => {
    const id = await newProduct(1)
    for (const qty of [0, -2, 1.5, Number.NaN, MAX_QTY + 1]) {
      await expect(createPurchase(input(id, { qty }), asAdmin())).rejects.toMatchObject({ status: 422 })
    }
    expect(await purchaseRows(id)).toHaveLength(0)
    expect(await warehouseOf(id)).toBe(1)
  })

  it('404 si el producto no existe; 409 si está desactivado', async () => {
    await expect(createPurchase(input(2_000_000_000), asAdmin())).rejects.toMatchObject({ code: 'not_found' })
    const id = await newProduct(2)
    await db.update(products).set({ active: false }).where(eq(products.id, id))
    await expect(createPurchase(input(id), asAdmin())).rejects.toMatchObject({ status: 409 })
    expect(await purchaseRows(id)).toHaveLength(0)
  })

  it('403 si quien registra o consulta es un vendedor', async () => {
    const id = await newProduct(3)
    const asSeller = { userId: seller.id, role: 'vendedor' }
    await expect(createPurchase(input(id), asSeller)).rejects.toMatchObject({ code: 'forbidden' })
    await expect(getPurchase(randomUUID(), asSeller)).rejects.toMatchObject({ code: 'forbidden' })
    expect(await purchaseRows(id)).toHaveLength(0)
  })

  it('repetir el requestId con los mismos datos responde la misma entrada sin duplicar piezas', async () => {
    const id = await newProduct(1)
    const request = input(id)
    const first = await createPurchase(request, asAdmin())
    const again = await createPurchase(request, asAdmin())
    expect(again.replayed).toBe(true)
    expect(again.purchase).toEqual(first.purchase)
    expect(await warehouseOf(id)).toBe(6)
    expect(await purchaseRows(id)).toHaveLength(1)
  })

  it('409 al repetir el requestId con otro producto o piezas', async () => {
    const id = await newProduct(1)
    const other = await newProduct(1)
    const request = input(id)
    await createPurchase(request, asAdmin())
    for (const change of [{ productId: other }, { qty: 1 }]) {
      await expect(createPurchase({ ...request, ...change }, asAdmin()))
        .rejects.toMatchObject({ status: 409, message: 'Esta entrada ya se registró con otros datos.' })
    }
    expect(await purchaseRows(id)).toHaveLength(1)
    expect(await purchaseRows(other)).toHaveLength(0)
  })

  it('dos peticiones iguales a la vez dejan una sola entrada', async () => {
    const id = await newProduct(1)
    const request = input(id)
    const results = await Promise.all([createPurchase(request, asAdmin()), createPurchase(request, asAdmin())])
    expect(results.filter((r) => r.replayed)).toHaveLength(1)
    expect(await purchaseRows(id)).toHaveLength(1)
    expect(await warehouseOf(id)).toBe(6)
  })

  it('GET devuelve la entrada con los mismos saldos; uno inexistente da 404', async () => {
    const id = await newProduct(2)
    const { purchase } = await createPurchase(input(id), asAdmin())
    await createPurchase(input(id, { qty: 1 }), asAdmin()) // otra entrada después no cambia la primera
    expect(await getPurchase(purchase.requestId, asAdmin())).toEqual(purchase)
    await expect(getPurchase(randomUUID(), asAdmin())).rejects.toMatchObject({ code: 'not_found' })
  })

  describe('rutas /api/purchases', () => {
    const postAs = (token: string | undefined, body: Record<string, unknown>) =>
      postPurchaseRoute(new Request('http://api.test/api/purchases', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      }), undefined)

    it('401 sin sesión, 403 con un vendedor y sin filas nuevas', async () => {
      const id = await newProduct(2)
      const body = { requestId: randomUUID(), productId: id, qty: 3 }
      expect((await postAs(undefined, body)).status).toBe(401)
      expect((await postAs(seller.token, body)).status).toBe(403)
      expect(await purchaseRows(id)).toHaveLength(0)
    })

    it('201 la primera vez, 200 al repetir; 422 con un requestId que no es UUID; GET relee la entrada', async () => {
      const id = await newProduct(2)
      const body = { requestId: randomUUID(), productId: id, qty: 3 }
      const first = await postAs(admin.token, body)
      expect(first.status).toBe(201)
      expect((await first.json()).purchase.stock).toEqual({ before: 2, after: 5 })
      const again = await postAs(admin.token, body)
      expect(again.status).toBe(200)
      expect((await again.json()).replayed).toBe(true)
      expect((await postAs(admin.token, { ...body, requestId: 'no-es-uuid' })).status).toBe(422)

      const read = await getPurchaseRoute(new Request('http://api.test/api/purchases/x', {
        headers: { authorization: `Bearer ${admin.token}` },
      }), { params: Promise.resolve({ requestId: body.requestId }) })
      expect(read.status).toBe(200)
      expect((await read.json()).purchase.qty).toBe(3)
    })
  })
})
