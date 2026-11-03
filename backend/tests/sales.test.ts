import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as getSaleRoute } from '@api/sales/[requestId]/route'
import { POST as postSaleRoute } from '@api/sales/route'
import { GET as stockOverviewRoute } from '@api/stock/route'
import { db, sql } from '@db/client'
import { directSaleItems, directSales, products, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { insertMovements, setHolderPrices } from '@stock'
import { cleanupSales, cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

// Productos de prueba con prefijo propio, para limpiarlos sin tocar el catálogo.
const PREFIX = 'test-sales-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

const headers = (token?: string): Record<string, string> =>
  token ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : {}

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

describe.skipIf(!hasServiceKey)('Ventas (T-18, con cuentas reales)', () => {
  let admin: TestUser
  let seller: TestUser
  let otherSeller: TestUser
  let inactiveSeller: TestUser

  const newProduct = async (label: string, qty = 10, opts: { archived?: boolean; price?: string; unitCost?: string } = {}) => {
    const [product] = await db.insert(products)
      .values({ name: productName(label), price: opts.price ?? '450', unitCost: opts.unitCost ?? '300', active: !opts.archived })
      .returning()
    if (qty > 0) {
      await withTransaction((tx) => insertMovements(tx, [
        { productId: product!.id, type: 'initial', qty, holderProfileId: null, createdBy: admin.id },
      ]))
    }
    return product!.id
  }

  // Le deja `qty` piezas al vendedor con dos movimientos `delivery`, y fija sus precios propios.
  const giveToSeller = async (
    productId: number, qty: number, prices: { unitPrice: string | null; unitCostWithShipping: string | null } = { unitPrice: null, unitCostWithShipping: null },
    sellerId = seller.id,
  ) => {
    await withTransaction(async (tx) => {
      await insertMovements(tx, [
        { productId, type: 'delivery', qty: -qty, holderProfileId: null, createdBy: admin.id },
        { productId, type: 'delivery', qty, holderProfileId: sellerId, createdBy: admin.id },
      ])
      await setHolderPrices(tx, sellerId, productId, prices)
    })
  }

  const postAs = (token: string | undefined, body: Record<string, unknown>) =>
    postSaleRoute(new Request('http://api.test/api/sales', { method: 'POST', headers: headers(token), body: JSON.stringify(body) }), undefined)
  const getAs = (token: string | undefined, requestId: string) =>
    getSaleRoute(new Request('http://api.test/api/sales/x', { headers: headers(token) }), { params: Promise.resolve({ requestId }) })
  const sell = (token: string, lines: { productId: number; qty: unknown }[], extra: Record<string, unknown> = {}) =>
    postAs(token, { requestId: randomUUID(), lines, ...extra })

  const stockOf = async (productId: number) => {
    const [product] = await db.select().from(products).where(eq(products.id, productId))
    const [held] = await db.select().from(vendorStock).where(eq(vendorStock.productId, productId))
    return { warehouse: product!.stock, seller: held?.qty ?? 0 }
  }
  const counts = async (productIds: number[]) => ({
    sales: (await db.select().from(directSales)).length,
    items: (await db.select().from(directSaleItems).where(inArray(directSaleItems.productId, productIds))).length,
    movements: (await db.select().from(stockMovements).where(inArray(stockMovements.productId, productIds))).length,
  })

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    admin = await createTestUser('t18-admin', { role: 'admin' })
    seller = await createTestUser('t18-luis', { role: 'vendedor' })
    otherSeller = await createTestUser('t18-otro', { role: 'vendedor' })
    inactiveSeller = await createTestUser('t18-inactivo', { role: 'vendedor', active: false })
  }, 60_000)

  afterAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('bodega: el administrador vende y baja products.stock, con el movimiento ligado a la venta', async () => {
    const productId = await newProduct('bodega', 4)
    const res = await sell(admin.token, [{ productId, qty: 2 }])
    expect(res.status).toBe(201)
    const { sale, replayed } = await res.json()
    expect(replayed).toBe(false)
    expect(sale).toMatchObject({
      soldById: admin.id, holder: null, total: '900.00', profit: '300.00',
      lines: [{ productId, qty: 2, unitPrice: '450.00', subtotal: '900.00', unitCost: '300.0000', profit: '300.00', stock: { before: 4, after: 2 }, image: null }],
    })
    expect(await stockOf(productId)).toMatchObject({ warehouse: 2 })
    const rows = await db.select().from(stockMovements).where(eq(stockMovements.directSaleId, sale.id))
    expect(rows.map((row) => [row.type, row.qty, row.holderProfileId, row.requestId])).toEqual([['direct_sale', -2, null, null]])
  })

  it('vendedor: baja su vendor_stock y no cambia la bodega; GET /api/stock baja el total', async () => {
    const productId = await newProduct('vendedor', 10)
    await giveToSeller(productId, 6)
    const total = async () => {
      const res = await stockOverviewRoute(new Request('http://api.test/api/stock', { headers: headers(admin.token) }), undefined)
      const body = await res.json()
      return body.products.find((product: { productId: number }) => product.productId === productId).total as number
    }
    expect(await total()).toBe(10)

    const res = await sell(seller.token, [{ productId, qty: 2 }])
    expect(res.status).toBe(201)
    expect((await res.json()).sale).toMatchObject({ holder: { id: seller.id }, lines: [{ stock: { before: 6, after: 4 } }] })
    expect(await stockOf(productId)).toMatchObject({ warehouse: 4, seller: 4 })
    expect(await total()).toBe(8)
  })

  it('varios productos: dos renglones y dos movimientos con el mismo direct_sale_id', async () => {
    const first = await newProduct('multi-a', 5)
    const second = await newProduct('multi-b', 5, { price: '100' })
    const { sale } = await (await sell(admin.token, [{ productId: first, qty: 1 }, { productId: second, qty: 3 }])).json()
    expect(sale.lines.map((line: { productId: number }) => line.productId)).toEqual([first, second])
    expect(sale.total).toBe('750.00')
    const rows = await db.select().from(stockMovements).where(eq(stockMovements.directSaleId, sale.id))
    expect(rows).toHaveLength(2)
  })

  it('el administrador vende del stock de un vendedor: sold_by es el admin y holder el vendedor', async () => {
    const productId = await newProduct('a-nombre', 5)
    await giveToSeller(productId, 5)
    const { sale } = await (await sell(admin.token, [{ productId, qty: 2 }], { holderId: seller.id })).json()
    const [row] = await db.select().from(directSales).where(eq(directSales.id, sale.id))
    expect(row).toMatchObject({ soldBy: admin.id, holderProfileId: seller.id })
    expect(await stockOf(productId)).toMatchObject({ warehouse: 0, seller: 3 })
  })

  it('precios: propios del vendedor, generales si son null, bodega y costo de 4 decimales', async () => {
    const own = await newProduct('precio-propio', 5)
    await giveToSeller(own, 5, { unitPrice: '520', unitCostWithShipping: '310.5' })
    const ownSale = (await (await sell(seller.token, [{ productId: own, qty: 2 }])).json()).sale
    expect(ownSale.lines[0]).toBeDefined()

    const general = await newProduct('precio-general', 5)
    await giveToSeller(general, 5)
    const generalAdmin = (await (await sell(admin.token, [{ productId: general, qty: 1 }], { holderId: seller.id })).json()).sale
    expect(generalAdmin.lines[0]).toMatchObject({ unitPrice: '450.00', unitCost: '300.0000' })

    const ownAdmin = (await (await sell(admin.token, [{ productId: own, qty: 1 }], { holderId: seller.id })).json()).sale
    expect(ownAdmin.lines[0]).toMatchObject({ unitPrice: '520.00', unitCost: '310.5000', profit: '209.50' })

    // Costo de 4 decimales: 3 × (50 − 10.1235) = 119.6295 → 119.63, redondeado una sola vez.
    const fine = await newProduct('costo-fino', 5, { price: '50', unitCost: '10.1235' })
    const fineSale = (await (await sell(admin.token, [{ productId: fine, qty: 3 }])).json()).sale
    expect(fineSale.lines[0]).toMatchObject({ subtotal: '150.00', profit: '119.63' })
    expect(fineSale.profit).toBe('119.63')
  })

  it('la ganancia de la venta se redondea una sola vez sobre la suma en diezmilésimas', async () => {
    // Cada renglón gana 0.0050 (se redondea a 0.01); juntos 0.0100 → 0.01, no 0.02.
    const a = await newProduct('suma-a', 5, { price: '1', unitCost: '0.9950' })
    const b = await newProduct('suma-b', 5, { price: '1', unitCost: '0.9950' })
    const { sale } = await (await sell(admin.token, [{ productId: a, qty: 1 }, { productId: b, qty: 1 }])).json()
    expect(sale.lines.map((line: { profit: string }) => line.profit)).toEqual(['0.01', '0.01'])
    expect(sale.profit).toBe('0.01')
  })

  it('editar el producto después no cambia la venta guardada', async () => {
    const productId = await newProduct('congelado', 5)
    const { sale } = await (await sell(admin.token, [{ productId, qty: 1 }])).json()
    await db.update(products).set({ price: '999', unitCost: '1' }).where(eq(products.id, productId))
    const after = await (await getAs(admin.token, sale.requestId)).json()
    expect(after.sale.lines[0]).toMatchObject({ unitPrice: '450.00', unitCost: '300.0000' })
    expect(after.sale.total).toBe('450.00')
  })

  it('atomicidad: un renglón que no alcanza da 409 y no queda nada', async () => {
    const enough = await newProduct('atomico-a', 5)
    const short = await newProduct('atomico-b', 1)
    const before = await counts([enough, short])
    const res = await sell(admin.token, [{ productId: enough, qty: 2 }, { productId: short, qty: 2 }])
    expect(res.status).toBe(409)
    expect((await res.json()).error.message).toBe('No hay piezas suficientes')
    expect(await counts([enough, short])).toEqual(before)
    expect(await stockOf(enough)).toMatchObject({ warehouse: 5 })
  })

  it('un vendedor que nunca tuvo el producto recibe 409 y no se crea fila en vendor_stock', async () => {
    const productId = await newProduct('ajeno', 5)
    const res = await sell(seller.token, [{ productId, qty: 1 }])
    expect(res.status).toBe(409)
    expect(await db.select().from(vendorStock).where(eq(vendorStock.productId, productId))).toHaveLength(0)
  })

  it('idempotencia: repetir (en otro orden) da 200 y replayed; no mueve nada otra vez', async () => {
    const first = await newProduct('idem-a', 5)
    const second = await newProduct('idem-b', 5)
    const requestId = randomUUID()
    const lines = [{ productId: first, qty: 1 }, { productId: second, qty: 2 }]
    const created = await postAs(admin.token, { requestId, lines })
    expect(created.status).toBe(201)
    const repeated = await postAs(admin.token, { requestId, lines: [...lines].reverse() })
    expect(repeated.status).toBe(200)
    const body = await repeated.json()
    expect(body.replayed).toBe(true)
    expect(body.sale.id).toBe((await created.json()).sale.id)
    expect(await stockOf(first)).toMatchObject({ warehouse: 4 })
    expect(await stockOf(second)).toMatchObject({ warehouse: 3 })
  })

  it('dos peticiones iguales a la vez dejan una sola venta', async () => {
    const productId = await newProduct('carrera', 5)
    const requestId = randomUUID()
    const body = { requestId, lines: [{ productId, qty: 2 }] }
    const results = await Promise.all([postAs(admin.token, body), postAs(admin.token, body)])
    expect(results.map((res) => res.status).sort()).toEqual([200, 201])
    expect(await db.select().from(directSales).where(eq(directSales.requestId, requestId))).toHaveLength(1)
    expect(await stockOf(productId)).toMatchObject({ warehouse: 3 })
  })

  it('el mismo requestId con otro qty, otro titular u otra cuenta da 409', async () => {
    const productId = await newProduct('mismatch', 10)
    await giveToSeller(productId, 5)
    const requestId = randomUUID()
    await postAs(admin.token, { requestId, lines: [{ productId, qty: 1 }] })

    const otherQty = await postAs(admin.token, { requestId, lines: [{ productId, qty: 2 }] })
    expect(otherQty.status).toBe(409)
    expect((await otherQty.json()).error.message).toBe('Esta venta ya se registró con otros datos.')
    expect((await postAs(admin.token, { requestId, holderId: seller.id, lines: [{ productId, qty: 1 }] })).status).toBe(409)

    const sellerRequest = randomUUID()
    await postAs(seller.token, { requestId: sellerRequest, lines: [{ productId, qty: 1 }] })
    await giveToSeller(productId, 2, undefined, otherSeller.id)
    expect((await postAs(otherSeller.token, { requestId: sellerRequest, lines: [{ productId, qty: 1 }] })).status).toBe(409)
  })

  it('validaciones: qty inválida, renglones de más o de menos, repetidos y requestId dan 422', async () => {
    const productId = await newProduct('validar', 5)
    for (const qty of [0, -1, 1.5, '2']) {
      expect((await sell(admin.token, [{ productId, qty }])).status, `qty ${String(qty)}`).toBe(422)
    }
    expect((await sell(admin.token, [])).status).toBe(422)
    const many = Array.from({ length: 51 }, () => ({ productId, qty: 1 }))
    expect((await sell(admin.token, many)).status).toBe(422)
    const repeated = await sell(admin.token, [{ productId, qty: 1 }, { productId, qty: 1 }])
    expect(repeated.status).toBe(422)
    expect((await repeated.json()).error.message).toBe('Un producto aparece dos veces en la venta')
    expect((await postAs(admin.token, { lines: [{ productId, qty: 1 }] })).status).toBe(422)
    expect((await postAs(admin.token, { requestId: 'no-uuid', lines: [{ productId, qty: 1 }] })).status).toBe(422)
    expect((await sell(admin.token, [{ productId, qty: 1 }], { holderId: 'no-uuid' })).status).toBe(422)
    expect(await stockOf(productId)).toMatchObject({ warehouse: 5 })
  })

  it('productos: el archivado con piezas se vende y el inexistente da 404', async () => {
    const archived = await newProduct('archivado', 3, { archived: true })
    expect((await sell(admin.token, [{ productId: archived, qty: 1 }])).status).toBe(201)
    expect((await sell(admin.token, [{ productId: 2_000_000_000, qty: 1 }])).status).toBe(404)
  })

  it('permisos: 401 sin token y con cuenta desactivada, 403 a un vendedor con titular ajeno, 404 a un titular inválido', async () => {
    const productId = await newProduct('permisos', 5)
    await giveToSeller(productId, 3)
    expect((await postAs(undefined, { requestId: randomUUID(), lines: [{ productId, qty: 1 }] })).status).toBe(401)
    expect([401, 403]).toContain((await sell(inactiveSeller.token, [{ productId, qty: 1 }])).status)
    expect((await sell(seller.token, [{ productId, qty: 1 }], { holderId: otherSeller.id })).status).toBe(403)
    expect((await sell(seller.token, [{ productId, qty: 1 }], { holderId: null })).status).toBe(403)
    expect((await sell(admin.token, [{ productId, qty: 1 }], { holderId: inactiveSeller.id })).status).toBe(404)
    expect((await sell(admin.token, [{ productId, qty: 1 }], { holderId: admin.id })).status).toBe(404)
    expect((await sell(seller.token, [{ productId, qty: 1 }], { holderId: seller.id })).status).toBe(201)
  })

  it('recorte por rol: el vendedor no recibe unitCost ni profit (POST y GET); el administrador sí', async () => {
    const productId = await newProduct('recorte', 6)
    await giveToSeller(productId, 6)
    const created = await (await sell(seller.token, [{ productId, qty: 1 }])).json()
    const fromGet = await (await getAs(seller.token, created.sale.requestId)).json()
    for (const sale of [created.sale, fromGet.sale]) {
      expect(sale).not.toHaveProperty('profit')
      expect(sale.lines[0]).not.toHaveProperty('unitCost')
      expect(sale.lines[0]).not.toHaveProperty('profit')
    }
    const asAdmin = await (await getAs(admin.token, created.sale.requestId)).json()
    expect(asAdmin.sale).toHaveProperty('profit')
    expect(asAdmin.sale.lines[0]).toHaveProperty('unitCost')
    expect(asAdmin.sale.lines[0]).toHaveProperty('profit')
  })

  it('GET: igual al POST tras la recarga; 404 para otro vendedor o inexistente; 422 si no es UUID', async () => {
    const productId = await newProduct('get', 6)
    await giveToSeller(productId, 6)
    const created = await (await sell(admin.token, [{ productId, qty: 2 }], { holderId: seller.id })).json()
    const res = await getAs(admin.token, created.sale.requestId)
    expect(res.status).toBe(200)
    expect((await res.json()).sale).toEqual(created.sale)

    expect((await getAs(seller.token, created.sale.requestId)).status).toBe(200)
    expect((await getAs(otherSeller.token, created.sale.requestId)).status).toBe(404)
    expect((await getAs(admin.token, randomUUID())).status).toBe(404)
    expect((await getAs(admin.token, 'no-uuid')).status).toBe(422)
  })

  it('la base rechaza un movimiento con direct_sale_id y otro tipo', async () => {
    const productId = await newProduct('check', 5)
    const { sale } = await (await sell(admin.token, [{ productId, qty: 1 }])).json()
    await expect(db.insert(stockMovements).values({
      productId, type: 'delivery', qty: 1, holderProfileId: null, createdBy: admin.id, directSaleId: sale.id,
    })).rejects.toThrow()
  })
})
