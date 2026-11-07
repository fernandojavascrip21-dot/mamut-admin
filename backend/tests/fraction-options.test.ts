import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as optionsRoute } from '@api/fractions/options/route'
import { db, sql } from '@db/client'
import { products, stockMovements } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { createFraction, listFractionOptions } from '@fractions'
import { createProduct } from '@products'
import { insertMovements } from '@stock'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-frac-opt-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

const req = (token?: string) =>
  new Request('http://api.test/api/fractions/options', { method: 'GET', headers: token ? { authorization: `Bearer ${token}` } : {} })

// Movimientos del más nuevo al más viejo (revierten saldos), luego fractions, bolsitas y enteros.
async function cleanupOptions() {
  const rows = await db.select({ id: products.id }).from(products).where(ilike(products.name, `${PREFIX}%`))
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return
  const movements = await db.select({ id: stockMovements.id }).from(stockMovements)
    .where(inArray(stockMovements.productId, ids)).orderBy(desc(stockMovements.id))
  for (const movement of movements) {
    await db.delete(stockMovements).where(eq(stockMovements.id, movement.id))
  }
  await sql`delete from fractions where product_id = any(${ids}) or portion_product_id = any(${ids})`
  const portions = await db.select({ id: products.id }).from(products).where(inArray(products.parentProductId, ids))
  if (portions.length > 0) await db.delete(products).where(inArray(products.id, portions.map((p) => p.id)))
  await db.delete(products).where(inArray(products.id, ids))
}

describe.skipIf(!hasServiceKey)('Opciones para fraccionar (HU-23, base real)', () => {
  let admin: TestUser
  let seller: TestUser
  let plain: number
  let withBag: number
  let withOffBag: number
  let empty: number
  let notFractionable: number
  let inactive: number

  const newProduct = async (label: string, opts: { fractionable?: boolean; qty?: number; unitCost?: string } = {}) => {
    const created = await createProduct({
      name: productName(label),
      categoryId: null,
      price: '900.00',
      unitCost: opts.unitCost ?? '450.0000',
      initialQty: opts.qty === 0 ? 1 : opts.qty ?? 3,
      fractionable: opts.fractionable ?? true,
      portionSize: opts.fractionable === false ? null : '30 g',
      image: null,
    }, admin.id)
    const id = created.id as number
    if (opts.qty === 0) {
      await withTransaction((tx) => insertMovements(tx, [{
        productId: id, type: 'shrinkage', qty: -1, holderProfileId: null, createdBy: admin.id,
      }]))
    }
    return id
  }
  const fractionOf = (productId: number) =>
    createFraction({ requestId: randomUUID(), productId, portions: 5, price: '95.00' }, { userId: admin.id, role: 'admin' })
  const mine = async () => (await listFractionOptions()).filter((o) => o.name.startsWith(PREFIX))

  beforeAll(async () => {
    admin = await createTestUser('frac-opt-admin', { role: 'admin' })
    seller = await createTestUser('frac-opt-seller', { role: 'vendedor' })
    plain = await newProduct('b-sin-bolsita', { qty: 4 })
    withBag = await newProduct('a-con-bolsita', { qty: 3 })
    withOffBag = await newProduct('c-bolsita-off', { qty: 2 })
    empty = await newProduct('d-sin-piezas', { qty: 0 })
    notFractionable = await newProduct('e-no-fraccionable', { fractionable: false })
    inactive = await newProduct('f-inactivo')
    await fractionOf(withBag)
    const off = await fractionOf(withOffBag)
    await db.update(products).set({ active: false }).where(eq(products.id, off.fraction.portionProduct.id))
    await db.update(products).set({ active: false }).where(eq(products.id, inactive))
  })
  afterAll(async () => {
    await cleanupOptions()
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  })

  it('un entero sin bolsita trae piezas en bodega, costo, porción y portionProduct null', async () => {
    const option = (await mine()).find((o) => o.productId === plain)!
    expect(option).toMatchObject({ warehouseUnits: 4, unitCost: '450.0000', portionSize: '30 g', portionProduct: null })
  })

  it('un entero con bolsita trae su id, nombre, precio y active true; el entero baja una pieza', async () => {
    const option = (await mine()).find((o) => o.productId === withBag)!
    expect(option.warehouseUnits).toBe(2)
    expect(option.portionProduct).toMatchObject({ price: '95.00', active: true })
    expect(option.portionProduct!.name).toContain('bolsita 30 g')
  })

  it('una bolsita desactivada sigue apareciendo con active false', async () => {
    const option = (await mine()).find((o) => o.productId === withOffBag)!
    expect(option.portionProduct).toMatchObject({ active: false })
  })

  it('un entero con 0 piezas aparece con warehouseUnits 0', async () => {
    const option = (await mine()).find((o) => o.productId === empty)!
    expect(option.warehouseUnits).toBe(0)
  })

  it('no lista productos no fraccionables, desactivados ni bolsitas', async () => {
    const ids = (await mine()).map((o) => o.productId)
    expect(ids).not.toContain(notFractionable)
    expect(ids).not.toContain(inactive)
    const options = await mine()
    const bagIds = options.flatMap((o) => (o.portionProduct ? [o.portionProduct.id] : []))
    expect(bagIds.length).toBeGreaterThan(0)
    expect(ids.some((id) => bagIds.includes(id))).toBe(false)
  })

  it('ordena por nombre sin importar mayúsculas', async () => {
    const names = (await mine()).map((o) => o.name)
    expect(names).toEqual([...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())))
    expect(names).toHaveLength(4)
  })

  it('la ruta responde 200 { products } al administrador', async () => {
    const response = await optionsRoute(req(admin.token), undefined)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { products: { productId: number }[] }
    expect(body.products.map((p) => p.productId)).toContain(plain)
  })

  it('responde 403 a un vendedor y 401 sin sesión', async () => {
    expect((await optionsRoute(req(seller.token), undefined)).status).toBe(403)
    expect((await optionsRoute(req(), undefined)).status).toBe(401)
  })
})
