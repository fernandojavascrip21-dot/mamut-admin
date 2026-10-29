import { and, desc, eq, ilike, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, sql } from '../src/db/client'
import { pgErrorCode } from '../src/db/errors'
import { products, stockMovements, vendorStock } from '../src/db/schema'
import { withTransaction } from '../src/db/transaction'
import { AppError } from '../src/lib/errors'
import { insertMovements, type NewStockMovement } from '../src/stock/movements'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

// Prefijo identificable para limpiar sin tocar el catálogo real (spec T-07 §7).
const PREFIX = 'test-stock-'
const name = () => `${PREFIX}${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// Los movimientos se borran del más nuevo al más viejo: el trigger revierte cada uno, y
// deshacer la historia en orden inverso nunca pasa por un saldo negativo. Después se borran
// las filas de vendor_stock (ya en 0) y los productos, por los FK `restrict`.
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

describe.skipIf(!hasServiceKey)('stock por movimientos (trigger en la base)', () => {
  let admin: TestUser
  let seller: TestUser

  const newProduct = async () => {
    const [product] = await db.insert(products).values({ name: name(), price: '100', unitCost: '50' }).returning()
    return product!.id
  }

  const move = (rows: Omit<NewStockMovement, 'createdBy'>[]) =>
    withTransaction((tx) => insertMovements(tx, rows.map((row) => ({ ...row, createdBy: admin.id }))))

  const warehouse = async (productId: number) => {
    const [row] = await db.select({ stock: products.stock }).from(products).where(eq(products.id, productId))
    return row!.stock
  }

  const sellerQty = async (productId: number) => {
    const [row] = await db.select({ qty: vendorStock.qty }).from(vendorStock)
      .where(and(eq(vendorStock.profileId, seller.id), eq(vendorStock.productId, productId)))
    return row?.qty
  }

  // El error de la base (sin traducir) que dejó el intento.
  const dbError = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (err) {
      return err
    }
    throw new Error('se esperaba que la base rechazara la operación')
  }

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    admin = await createTestUser('stock-admin', { role: 'admin' })
    seller = await createTestUser('stock-vendedor', { role: 'vendedor' })
  }, 60_000)

  afterAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('cada movimiento suma su qty al saldo de su dueño, y un traspaso son dos filas', async () => {
    const productId = await newProduct()
    expect(await warehouse(productId)).toBe(0)

    await move([{ productId, type: 'initial', qty: 5, holderProfileId: null }])
    expect(await warehouse(productId)).toBe(5)
    await move([{ productId, type: 'purchase', qty: 3, holderProfileId: null }])
    expect(await warehouse(productId)).toBe(8)
    await move([{ productId, type: 'shrinkage', qty: -2, holderProfileId: null }])
    expect(await warehouse(productId)).toBe(6)

    expect(await sellerQty(productId)).toBeUndefined()
    await move([
      { productId, type: 'delivery', qty: -4, holderProfileId: null },
      { productId, type: 'delivery', qty: 4, holderProfileId: seller.id },
    ])
    expect(await warehouse(productId)).toBe(2)
    expect(await sellerQty(productId)).toBe(4)

    await move([
      { productId, type: 'return', qty: -1, holderProfileId: seller.id },
      { productId, type: 'return', qty: 1, holderProfileId: null },
    ])
    expect(await warehouse(productId)).toBe(3)
    expect(await sellerQty(productId)).toBe(3)
  })

  it('un saldo que quedaría negativo da 409 y no cambia nada, en bodega y con el vendedor', async () => {
    const productId = await newProduct()
    await move([{ productId, type: 'initial', qty: 5, holderProfileId: null }])
    await move([
      { productId, type: 'delivery', qty: -2, holderProfileId: null },
      { productId, type: 'delivery', qty: 2, holderProfileId: seller.id },
    ])

    for (const holderProfileId of [null, seller.id]) {
      const err = await dbError(() => move([{ productId, type: 'shrinkage', qty: -10, holderProfileId }]))
      expect(err).toBeInstanceOf(AppError)
      expect(err).toMatchObject({ status: 409, message: 'No hay piezas suficientes' })
    }
    // Un traspaso que se queda corto revierte también la fila que sí cabía.
    await dbError(() => move([
      { productId, type: 'delivery', qty: -10, holderProfileId: null },
      { productId, type: 'delivery', qty: 10, holderProfileId: seller.id },
    ]))
    expect(await warehouse(productId)).toBe(3)
    expect(await sellerQty(productId)).toBe(2)
    expect(await db.select().from(stockMovements).where(eq(stockMovements.productId, productId))).toHaveLength(3)
  })

  it('rechaza qty 0 y cada combinación tipo/dueño/signo fuera de la tabla de §3', async () => {
    const productId = await newProduct()
    await move([{ productId, type: 'initial', qty: 5, holderProfileId: null }])

    const invalid: Omit<NewStockMovement, 'createdBy'>[] = [
      { productId, type: 'initial', qty: -1, holderProfileId: null },
      { productId, type: 'initial', qty: 1, holderProfileId: seller.id },
      { productId, type: 'purchase', qty: 1, holderProfileId: seller.id },
      { productId, type: 'delivery', qty: 1, holderProfileId: null },
      { productId, type: 'delivery', qty: -1, holderProfileId: seller.id },
      { productId, type: 'return', qty: -1, holderProfileId: null },
      { productId, type: 'return', qty: 1, holderProfileId: seller.id },
      { productId, type: 'direct_sale', qty: 1, holderProfileId: null },
      { productId, type: 'shrinkage', qty: 1, holderProfileId: seller.id },
      { productId, type: 'fraction_out', qty: 1, holderProfileId: null },
      { productId, type: 'direct_sale_void', qty: -1, holderProfileId: null },
      { productId, type: 'shrinkage_void', qty: -1, holderProfileId: seller.id },
      { productId, type: 'fraction_in', qty: -1, holderProfileId: null },
      { productId, type: 'adjustment', qty: 0, holderProfileId: null },
      { productId, type: 'purchase', qty: 0, holderProfileId: null },
    ]
    for (const row of invalid) {
      const err = await dbError(() => move([row]))
      expect(pgErrorCode(err), JSON.stringify(row)).toBe('23514')
    }
    expect(await warehouse(productId)).toBe(5)

    await move([{ productId, type: 'adjustment', qty: -1, holderProfileId: null }])
    await move([{ productId, type: 'adjustment', qty: 2, holderProfileId: null }])
    expect(await warehouse(productId)).toBe(6)
  })

  it('rechaza escribir products.stock y vendor_stock.qty directo', async () => {
    const productId = await newProduct()
    await move([
      { productId, type: 'initial', qty: 5, holderProfileId: null },
    ])
    await move([
      { productId, type: 'delivery', qty: -2, holderProfileId: null },
      { productId, type: 'delivery', qty: 2, holderProfileId: seller.id },
    ])

    for (const attempt of [
      () => sql`update products set stock = 99 where id = ${productId}`,
      () => sql`insert into products (name, price, unit_cost, stock) values (${name()}, 100, 50, 5)`,
      () => sql`update vendor_stock set qty = 99 where product_id = ${productId}`,
      () => sql`insert into vendor_stock (profile_id, product_id, qty) values (${admin.id}, ${productId}, 5)`,
    ]) {
      const err = await dbError(attempt)
      expect((err as Error).message).toMatch(/solo cambia con stock_movements/)
    }
    expect(await warehouse(productId)).toBe(3)
    expect(await sellerQty(productId)).toBe(2)

    // Los demás campos se siguen editando normal.
    await sql`update products set price = 120 where id = ${productId}`
  })

  it('un movimiento no se edita, y borrarlo revierte su efecto', async () => {
    const productId = await newProduct()
    await move([{ productId, type: 'initial', qty: 5, holderProfileId: null }])
    await move([{ productId, type: 'shrinkage', qty: -2, holderProfileId: null }])

    const err = await dbError(() => sql`update stock_movements set qty = -1 where product_id = ${productId} and type = 'shrinkage'`)
    expect((err as Error).message).toMatch(/no se edita/)
    expect(await warehouse(productId)).toBe(3)

    await db.delete(stockMovements).where(and(eq(stockMovements.productId, productId), eq(stockMovements.type, 'shrinkage')))
    expect(await warehouse(productId)).toBe(5)
  })

  it('dos salidas simultáneas de la última pieza: una pasa y la otra da 409', async () => {
    const productId = await newProduct()
    await move([{ productId, type: 'initial', qty: 1, holderProfileId: null }])

    const results = await Promise.allSettled([
      move([{ productId, type: 'shrinkage', qty: -1, holderProfileId: null }]),
      move([{ productId, type: 'shrinkage', qty: -1, holderProfileId: null }]),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toMatchObject({ status: 409 })
    expect(await warehouse(productId)).toBe(0)
  })
})
