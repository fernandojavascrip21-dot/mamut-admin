import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, sql } from '@db/client'
import { products, stockMovements, vendorStock } from '@db/schema'
import { createDelivery } from '@deliveries'
import { createProduct } from '@products'
import { createReturn } from '@returns'
import { createShrinkage, listShrinkageOptions, SHRINKAGE_REASONS } from '@shrinkage'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-shro-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// Movimientos del más nuevo al más viejo (revierten saldos), las filas de vendor_stock y los productos de prueba.
async function cleanupShrinkageOptions() {
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

describe.skipIf(!hasServiceKey)('Opciones de merma de un vendedor o de la bodega (HU-25, base real)', () => {
  let admin: TestUser
  let seller: TestUser
  let inactiveSeller: TestUser

  const asAdmin = () => ({ userId: admin.id, role: 'admin' })

  // Producto con `warehouse` piezas en bodega y `toSeller` de ellas dejadas al vendedor.
  const newProduct = async (label: string, warehouse: number, toSeller = 0) => {
    const created = await createProduct({
      name: productName(label),
      categoryId: null,
      price: '900.00',
      unitCost: '450.0000',
      initialQty: warehouse + toSeller,
      fractionable: false,
      portionSize: null,
      image: null,
    }, admin.id)
    const id = created.id as number
    if (toSeller > 0) {
      await createDelivery({
        requestId: randomUUID(), sellerId: seller.id, productId: id, qty: toSeller, unitPrice: null, unitCostWithShipping: null,
      }, admin.id)
    }
    return id
  }
  const mine = <T extends { name: string }>(list: T[]) => list.filter((item) => item.name.startsWith(PREFIX))

  beforeAll(async () => {
    admin = await createTestUser('shro-admin', { role: 'admin' })
    seller = await createTestUser('shro-seller', { role: 'vendedor' })
    inactiveSeller = await createTestUser('shro-inactive', { role: 'vendedor', active: false })
  })
  afterAll(async () => {
    await cleanupShrinkageOptions()
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  })

  it('vendedor: lista solo sus productos con piezas > 0, por nombre, con sus piezas y el titular', async () => {
    const b = await newProduct('b', 2, 5)
    const a = await newProduct('a', 0, 3)
    await newProduct('sin-piezas', 4) // el vendedor nunca lo tuvo
    const result = await listShrinkageOptions(seller.id, asAdmin())

    expect(result.holder).toEqual({ id: seller.id, fullName: 'Prueba shro-seller' })
    expect(mine(result.products).map((p) => ({ productId: p.productId, units: p.units }))).toEqual([
      { productId: a, units: 3 },
      { productId: b, units: 5 },
    ])
    expect(result.products[0]).toHaveProperty('image')
  })

  it('vendedor: un producto desactivado con piezas del vendedor sí se lista; con 0 piezas no', async () => {
    const off = await newProduct('off', 0, 3)
    await db.update(products).set({ active: false }).where(eq(products.id, off))
    const drained = await newProduct('drained', 0, 2)
    await createReturn({ requestId: randomUUID(), sellerId: seller.id, productId: drained, qty: 2 }, admin.id)

    const result = await listShrinkageOptions(seller.id, asAdmin())
    const ids = mine(result.products).map((p) => p.productId)
    expect(ids).toContain(off)
    expect(ids).not.toContain(drained)
  })

  it('bodega (sin vendedor): productos con stock > 0, desactivados incluidos, sin los de 0; holder null', async () => {
    const withStock = await newProduct('w-stock', 7)
    const off = await newProduct('w-off', 4)
    await db.update(products).set({ active: false }).where(eq(products.id, off))
    const zero = await newProduct('w-zero', 1)
    await createShrinkage({ requestId: randomUUID(), holderProfileId: null, productId: zero, qty: 1, reason: 'lost' }, asAdmin())
    const result = await listShrinkageOptions(null, asAdmin())

    expect(result.holder).toBeNull()
    const listed = mine(result.products)
    expect(listed.map((p) => p.productId)).toEqual(expect.arrayContaining([withStock, off]))
    expect(listed.map((p) => p.productId)).not.toContain(zero)
    expect(listed.find((p) => p.productId === withStock)?.units).toBe(7)
    expect(listed.find((p) => p.productId === off)?.units).toBe(4)
    const names = result.products.map((p) => p.name)
    expect(names).toEqual([...names].sort((x, y) => x.localeCompare(y, 'es')))
  })

  it('reasons sigue el orden de SHRINKAGE_REASONS con sus etiquetas', async () => {
    const expected = Object.entries(SHRINKAGE_REASONS).map(([code, label]) => ({ code, label }))
    expect((await listShrinkageOptions(seller.id, asAdmin())).reasons).toEqual(expected)
    expect((await listShrinkageOptions(null, asAdmin())).reasons).toEqual(expected)
    expect(expected.map((r) => r.label)).toEqual(['Se perdió', 'Dañado', 'Caducó', 'Otro'])
  })

  it('403 si quien consulta es un vendedor', async () => {
    const asSeller = { userId: seller.id, role: 'vendedor' }
    await expect(listShrinkageOptions(seller.id, asSeller)).rejects.toMatchObject({ code: 'forbidden' })
    await expect(listShrinkageOptions(null, asSeller)).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('404 con un vendedor desactivado, un administrador o un UUID inexistente', async () => {
    for (const id of [inactiveSeller.id, admin.id, randomUUID()]) {
      await expect(listShrinkageOptions(id, asAdmin())).rejects.toMatchObject({ code: 'not_found' })
    }
  })

  it('422 si el id del vendedor no es un UUID', async () => {
    await expect(listShrinkageOptions('no-es-uuid', asAdmin())).rejects.toMatchObject({ code: 'validation' })
  })

  it('solo lee: no crea movimientos', async () => {
    const id = await newProduct('read-only', 3, 3)
    const count = async () => (await db.select().from(stockMovements).where(eq(stockMovements.productId, id))).length
    const before = await count()
    await listShrinkageOptions(seller.id, asAdmin())
    await listShrinkageOptions(null, asAdmin())
    expect(await count()).toBe(before)
  })
})
