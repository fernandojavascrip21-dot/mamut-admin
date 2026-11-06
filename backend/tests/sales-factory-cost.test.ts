import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as getSaleRoute } from '@api/sales/[requestId]/route'
import { POST as postSaleRoute } from '@api/sales/route'
import { db, sql } from '@db/client'
import { directSaleItems, products, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { insertMovements, setHolderPrices } from '@stock'
import { cleanupSales, cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

// Productos de prueba con prefijo propio, para limpiarlos sin tocar el catálogo.
const PREFIX = 'test-sales-fc-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

const headers = (token: string): Record<string, string> =>
  ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' })

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

// T-22: cada renglón guarda el costo con envío (`unit_cost`) y, aparte, el de fábrica del momento.
describe.skipIf(!hasServiceKey)('Costo de fábrica en cada venta (T-22, con cuentas reales)', () => {
  let admin: TestUser
  let seller: TestUser

  // Producto con `qty` piezas en la bodega.
  const newProduct = async (label: string, qty: number, opts: { price?: string; unitCost?: string } = {}) => {
    const [product] = await db.insert(products)
      .values({ name: productName(label), price: opts.price ?? '450', unitCost: opts.unitCost ?? '300' })
      .returning()
    await withTransaction((tx) => insertMovements(tx, [
      { productId: product!.id, type: 'initial', qty, holderProfileId: null, createdBy: admin.id },
    ]))
    return product!.id
  }

  // Le deja `qty` piezas al vendedor con dos movimientos `delivery`, y fija sus precios propios.
  const giveToSeller = async (
    productId: number, qty: number,
    prices: { unitPrice: string | null; unitCostWithShipping: string | null } = { unitPrice: null, unitCostWithShipping: null },
  ) => {
    await withTransaction(async (tx) => {
      await insertMovements(tx, [
        { productId, type: 'delivery', qty: -qty, holderProfileId: null, createdBy: admin.id },
        { productId, type: 'delivery', qty, holderProfileId: seller.id, createdBy: admin.id },
      ])
      await setHolderPrices(tx, seller.id, productId, prices)
    })
  }

  const sell = (token: string, lines: { productId: number; qty: number }[], extra: Record<string, unknown> = {}) =>
    postSaleRoute(new Request('http://api.test/api/sales', {
      method: 'POST', headers: headers(token), body: JSON.stringify({ requestId: randomUUID(), lines, ...extra }),
    }), undefined)
  const getAs = (token: string, requestId: string) =>
    getSaleRoute(new Request('http://api.test/api/sales/x', { headers: headers(token) }), { params: Promise.resolve({ requestId }) })

  const costsOf = async (saleId: number) => {
    const rows = await db.select({ unitCost: directSaleItems.unitCost, factoryUnitCost: directSaleItems.factoryUnitCost })
      .from(directSaleItems).where(eq(directSaleItems.directSaleId, saleId))
    return rows.map((row) => [row.unitCost, row.factoryUnitCost])
  }

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    admin = await createTestUser('t22-ventas-admin', { role: 'admin' })
    seller = await createTestUser('t22-ventas-luis', { role: 'vendedor' })
  }, 60_000)

  afterAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('vendedor con costo con envío propio 700 sobre fábrica 600: guarda 700 y 600, venda él o el administrador', async () => {
    const productId = await newProduct('fabrica-con-envio', 10, { price: '920', unitCost: '600' })
    await giveToSeller(productId, 4, { unitPrice: null, unitCostWithShipping: '700' })

    const bySeller = (await (await sell(seller.token, [{ productId, qty: 1 }])).json()).sale
    const byAdmin = (await (await sell(admin.token, [{ productId, qty: 1 }], { holderId: seller.id })).json()).sale
    expect(await costsOf(bySeller.id)).toEqual([['700.0000', '600.0000']])
    expect(await costsOf(byAdmin.id)).toEqual([['700.0000', '600.0000']])
  })

  it('vendedor sin costo con envío propio y venta de bodega: los dos costos son el de fábrica', async () => {
    const held = await newProduct('fabrica-sin-envio', 10, { unitCost: '312.3456' })
    await giveToSeller(held, 3)
    const warehouse = await newProduct('fabrica-bodega', 5, { unitCost: '250.5' })

    const sellerSale = (await (await sell(seller.token, [{ productId: held, qty: 1 }])).json()).sale
    const warehouseSale = (await (await sell(admin.token, [{ productId: warehouse, qty: 2 }])).json()).sale
    expect(await costsOf(sellerSale.id)).toEqual([['312.3456', '312.3456']])
    expect(await costsOf(warehouseSale.id)).toEqual([['250.5000', '250.5000']])
  })

  it('el costo de fábrica solo se guarda: ni POST ni GET de la venta traen factoryUnitCost', async () => {
    const productId = await newProduct('fabrica-respuesta', 10, { unitCost: '600' })
    await giveToSeller(productId, 4, { unitPrice: null, unitCostWithShipping: '700' })

    const posted = await (await sell(admin.token, [{ productId, qty: 1 }], { holderId: seller.id })).json()
    const asAdmin = await (await getAs(admin.token, posted.sale.requestId)).json()
    const asSeller = await (await getAs(seller.token, posted.sale.requestId)).json()
    for (const body of [posted, asAdmin, asSeller]) {
      expect(JSON.stringify(body)).not.toContain('factoryUnitCost')
    }
  })
})
