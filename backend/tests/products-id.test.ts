import { eq, ilike, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET, PATCH } from '../app/api/products/[id]/route'
import { db, sql } from '../src/db/client'
import { categories, products, stockMovements } from '../src/db/schema'
import { createProduct } from '../src/products/products'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-prod-id-'
const name = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// `ilike`: el caso de «otras mayúsculas» deja nombres como `TEST-PROD-ID-…`, que `like` no borraría.
async function cleanupProducts() {
  const rows = await db.select({ id: products.id }).from(products).where(ilike(products.name, `${PREFIX}%`))
  const ids = rows.map((row) => row.id)
  if (ids.length) {
    await db.delete(stockMovements).where(inArray(stockMovements.productId, ids))
    await db.delete(products).where(inArray(products.id, ids))
  }
}

const request = (id: string | number, token?: string, body?: unknown) =>
  new Request(`http://api.test/api/products/${id}`, {
    method: body === undefined ? 'GET' : 'PATCH',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const ctx = (id: string | number) => ({ params: Promise.resolve({ id: String(id) }) })

describe.skipIf(!hasServiceKey)('producto por id (con cuentas reales)', () => {
  let admin: TestUser
  let vendedor: TestUser
  let categoryId: number

  // Las piezas solo entran como movimiento `initial` (T-07): nunca se escribe `stock` directo.
  const insertProduct = () => createProduct({
    name: name('base'), categoryId: null, price: '100.00', unitCost: '50.0000', initialQty: 8,
    fractionable: true, portionSize: '30 g', image: 'https://cdn.test/old.png',
  }, admin.id)

  const validBody = (productName: string, overrides: Record<string, unknown> = {}) => ({
    name: productName, categoryId: null, price: 100, unitCost: 50,
    fractionable: true, portionSize: '30 g', image: 'https://cdn.test/new.png',
    ...overrides,
  })

  beforeAll(async () => {
    await cleanupTestData()
    await cleanupProducts()
    admin = await createTestUser('prod-id-admin', { role: 'admin' })
    vendedor = await createTestUser('prod-id-vendedor', { role: 'vendedor' })
    const [category] = await db.select().from(categories).limit(1)
    categoryId = category!.id
  }, 60_000)

  afterAll(async () => {
    await cleanupProducts()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('GET da producto completo solo a admin y 404 para inactivo o inexistente', async () => {
    const product = await insertProduct()
    const res = await GET(request(product.id, admin.token), ctx(product.id))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: product.id, unitCost: '50.0000', portionSize: '30 g' })
    expect((await GET(request(product.id), ctx(product.id))).status).toBe(401)
    expect((await GET(request(product.id, vendedor.token), ctx(product.id))).status).toBe(403)
    expect((await GET(request('abc', admin.token), ctx('abc'))).status).toBe(422)
    expect((await GET(request(999999999, admin.token), ctx(999999999))).status).toBe(404)
    await db.update(products).set({ active: false }).where(eq(products.id, product.id))
    expect((await GET(request(product.id, admin.token), ctx(product.id))).status).toBe(404)
  })

  it('PATCH cambia los campos editables, ignora stock y no crea movimientos', async () => {
    const product = await insertProduct()
    const body = validBody(name('updated'), {
      categoryId, price: 140, unitCost: 70, portionSize: '25 g', stock: 900, initialQty: 900,
    })
    const res = await PATCH(request(product.id, admin.token, body), ctx(product.id))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      name: body.name, categoryId, price: '140.00', unitCost: '70.0000',
      stock: 8, portionSize: '25 g', image: body.image,
    })
    const movements = await db.select().from(stockMovements).where(eq(stockMovements.productId, product.id))
    expect(movements).toHaveLength(1)
    expect(movements[0]).toMatchObject({ type: 'initial', qty: 8 })
  })

  it('PATCH rechaza duplicado y acepta su propio nombre con otras mayúsculas', async () => {
    const first = await insertProduct()
    const second = await insertProduct()
    expect((await PATCH(request(first.id, admin.token, validBody(second.name)), ctx(first.id))).status).toBe(409)
    const same = await PATCH(request(first.id, admin.token, validBody(first.name.toUpperCase())), ctx(first.id))
    expect(same.status).toBe(200)
  })

  it('PATCH valida campos, categoría y precio menor al costo', async () => {
    const product = await insertProduct()
    for (const overrides of [
      { name: '' }, { price: 0 }, { unitCost: 0 }, { price: 40, unitCost: 50 },
      { fractionable: true, portionSize: null }, { categoryId: -999999 },
    ]) {
      const res = await PATCH(request(product.id, admin.token, validBody(product.name, overrides)), ctx(product.id))
      expect(res.status).toBe(422)
    }
    expect((await PATCH(request(product.id, admin.token, { ...validBody(product.name), image: undefined }), ctx(product.id))).status).toBe(422)
    const res = await PATCH(request(product.id, admin.token, validBody(product.name, {
      fractionable: false, portionSize: 'ignored', image: '', price: 50, unitCost: 50,
    })), ctx(product.id))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ fractionable: false, portionSize: null, image: '' })
  })

  // Dinero sin flotantes (spec T-08 §3): nunca se redondea en silencio.
  it('PATCH de dinero: 422 sin guardar ni redondear, acepta texto o número y compara escalas', async () => {
    const product = await insertProduct()
    for (const [overrides, message] of [
      [{ price: '450.555' }, 'El precio admite hasta 2 decimales'],
      [{ unitCost: '1.00001' }, 'El costo admite hasta 4 decimales'],
      [{ price: '100000000' }, 'El precio es demasiado grande'],
      [{ unitCost: '1000000', price: '2000000' }, 'El costo es demasiado grande'],
      [{ price: '1e3' }, 'El precio no es un monto válido'],
      [{ price: '450,50' }, 'El precio no es un monto válido'],
      [{ price: '83.33', unitCost: '83.3301' }, 'El precio no puede ser menor que el costo'],
    ] as const) {
      const res = await PATCH(request(product.id, admin.token, validBody(product.name, overrides)), ctx(product.id))
      expect(res.status, JSON.stringify(overrides)).toBe(422)
      expect(await res.json()).toMatchObject({ error: { message } })
    }
    const [unchanged] = await db.select().from(products).where(eq(products.id, product.id))
    expect(unchanged).toMatchObject({ price: '100.00', unitCost: '50.0000' })

    for (const price of ['450.5', 450.5]) {
      const res = await PATCH(request(product.id, admin.token, validBody(product.name, { price })), ctx(product.id))
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ price: '450.50' })
    }
    const equal = await PATCH(request(product.id, admin.token, validBody(product.name, {
      price: '83.33', unitCost: '83.3300',
    })), ctx(product.id))
    expect(equal.status).toBe(200)
    expect(await equal.json()).toMatchObject({ price: '83.33', unitCost: '83.3300' })
  })

  it('PATCH da 404 para inexistente e inactivo y 403 para vendedor', async () => {
    const product = await insertProduct()
    const body = validBody(product.name)
    expect((await PATCH(request(product.id, vendedor.token, body), ctx(product.id))).status).toBe(403)
    expect((await PATCH(request(999999999, admin.token, body), ctx(999999999))).status).toBe(404)
    await db.update(products).set({ active: false }).where(eq(products.id, product.id))
    expect((await PATCH(request(product.id, admin.token, body), ctx(product.id))).status).toBe(404)
  })
})
