import { eq, ilike, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as listProductsRoute, POST as createProductRoute } from '../app/api/products/route'
import { db, sql } from '../src/db/client'
import { categories, products, stockMovements } from '../src/db/schema'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

// Prefijo identificable para poder limpiar lo que crean estas pruebas sin tocar el catálogo
// real (que el sitio Vue hermano lee de la misma tabla `products`).
const PREFIX = 'test-prod-'

const req = (token?: string, body?: unknown) =>
  new Request('http://api.test/api/products', {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const uniqueName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`

const validBody = (overrides: Record<string, unknown> = {}) => ({
  name: uniqueName('ok'),
  categoryId: null,
  price: 100,
  unitCost: 50,
  initialQty: 10,
  fractionable: false,
  portionSize: null,
  image: null,
  ...overrides,
})

// El FK stock_movements_product_id_fkey es `restrict`: hay que borrar los movimientos antes
// que los productos. `ilike` porque algunas pruebas cambian las mayúsculas del nombre.
async function cleanupProducts() {
  const rows = await db.select({ id: products.id }).from(products).where(ilike(products.name, `${PREFIX}%`))
  const ids = rows.map((r) => r.id)
  if (ids.length === 0) return
  await db.delete(stockMovements).where(inArray(stockMovements.productId, ids))
  await db.delete(products).where(inArray(products.id, ids))
}

describe.skipIf(!hasServiceKey)('productos (con cuentas reales)', () => {
  let admin: TestUser
  let vendedor: TestUser
  let categoryId: number

  beforeAll(async () => {
    await cleanupTestData()
    await cleanupProducts()
    admin = await createTestUser('prod-admin', { role: 'admin' })
    vendedor = await createTestUser('prod-vendedor', { role: 'vendedor' })
    const [category] = await db.select().from(categories).limit(1)
    categoryId = category!.id
  }, 60_000)

  afterAll(async () => {
    await cleanupProducts()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('sin token da 401 y con token de vendedor da 403, sin productos ni unitCost', async () => {
    expect((await listProductsRoute(req(), undefined)).status).toBe(401)
    expect((await createProductRoute(req(undefined, validBody()), undefined)).status).toBe(401)

    const vendedorRes = await listProductsRoute(req(vendedor.token), undefined)
    expect(vendedorRes.status).toBe(403)
    const vendedorBody = await vendedorRes.json()
    expect(vendedorBody).toHaveProperty('error.code')
    expect(vendedorBody).toHaveProperty('error.message')
    expect(vendedorBody).not.toHaveProperty('unitCost')

    expect((await createProductRoute(req(vendedor.token, validBody()), undefined)).status).toBe(403)
  })

  it('el admin da de alta un producto y nace con su movimiento de stock inicial', async () => {
    const res = await createProductRoute(req(admin.token, validBody({ categoryId, initialQty: 7 })), undefined)
    expect(res.status).toBe(201)
    const created = (await res.json()) as { id: number; stock: number }
    expect(created.stock).toBe(7)

    const movements = await db.select().from(stockMovements).where(eq(stockMovements.productId, created.id))
    expect(movements).toHaveLength(1)
    expect(movements[0]).toMatchObject({ type: 'initial', qty: 7, holderProfileId: null })

    const list = (await (await listProductsRoute(req(admin.token), undefined)).json()) as Array<
      Record<string, unknown>
    >
    const row = list.find((p) => p['id'] === created.id)
    expect(row).toMatchObject({ price: '100.00', stock: 7, fractionable: false, image: '' })
    expect(row).not.toHaveProperty('unitCost')
    expect(row).not.toHaveProperty('portionSize')
    expect(row).not.toHaveProperty('active')
  })

  it('un producto marcado active = false no aparece en la lista', async () => {
    const res = await createProductRoute(req(admin.token, validBody()), undefined)
    const created = (await res.json()) as { id: number }
    await db.update(products).set({ active: false }).where(eq(products.id, created.id))

    const list = (await (await listProductsRoute(req(admin.token), undefined)).json()) as Array<{ id: number }>
    expect(list.some((p) => p.id === created.id)).toBe(false)
  })

  it('acepta categoryId nulo', async () => {
    const res = await createProductRoute(req(admin.token, validBody({ categoryId: null })), undefined)
    expect(res.status).toBe(201)
  })

  it('nombre repetido (sin distinguir mayúsculas/espacios) da 409 y no crea nada', async () => {
    const name = uniqueName('dup')
    const first = await createProductRoute(req(admin.token, validBody({ name })), undefined)
    expect(first.status).toBe(201)

    const second = await createProductRoute(
      req(admin.token, validBody({ name: `  ${name.toUpperCase()}  ` })),
      undefined,
    )
    expect(second.status).toBe(409)

    const rows = await db.select().from(products).where(eq(products.name, name))
    expect(rows).toHaveLength(1)
  })

  it('categoryId inexistente da 422, no 500', async () => {
    const res = await createProductRoute(req(admin.token, validBody({ categoryId: -999999 })), undefined)
    expect(res.status).toBe(422)
  })

  it('fractionable sin portionSize da 422', async () => {
    const res = await createProductRoute(
      req(admin.token, validBody({ fractionable: true, portionSize: null })),
      undefined,
    )
    expect(res.status).toBe(422)
  })

  it('fractionable con portionSize se guarda bien', async () => {
    const res = await createProductRoute(
      req(admin.token, validBody({ fractionable: true, portionSize: '30 g' })),
      undefined,
    )
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ fractionable: true, portionSize: '30 g' })
  })

  it('precio menor que costo da 422 sin crear producto; precio igual se acepta', async () => {
    const name = uniqueName('price')
    const invalid = await createProductRoute(
      req(admin.token, validBody({ name, price: 49, unitCost: 50 })), undefined,
    )
    expect(invalid.status).toBe(422)
    expect(await invalid.json()).toMatchObject({ error: { message: 'El precio no puede ser menor que el costo' } })
    expect(await db.select().from(products).where(eq(products.name, name))).toHaveLength(0)

    const equal = await createProductRoute(
      req(admin.token, validBody({ name, price: 50, unitCost: 50 })), undefined,
    )
    expect(equal.status).toBe(201)
  })

  it('valida el cuerpo: nombre vacío, costo/precio/piezas <= 0, piezas decimales', async () => {
    expect((await createProductRoute(req(admin.token, validBody({ name: '  ' })), undefined)).status).toBe(422)
    expect((await createProductRoute(req(admin.token, validBody({ price: 0 })), undefined)).status).toBe(422)
    expect((await createProductRoute(req(admin.token, validBody({ unitCost: 0 })), undefined)).status).toBe(422)
    expect((await createProductRoute(req(admin.token, validBody({ initialQty: 0 })), undefined)).status).toBe(422)
    expect((await createProductRoute(req(admin.token, validBody({ initialQty: 2.5 })), undefined)).status).toBe(422)
  })

  // Dinero sin flotantes (spec T-08 §3): nunca se redondea en silencio.
  it('dinero: decimales de más, montos fuera de rango y formatos inválidos dan 422 sin guardar', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ price: '450.555' }, 'El precio admite hasta 2 decimales'],
      [{ unitCost: '1.00001' }, 'El costo admite hasta 4 decimales'],
      [{ price: '100000000' }, 'El precio es demasiado grande'],
      [{ unitCost: '1000000', price: '2000000' }, 'El costo es demasiado grande'],
      [{ price: 0.30000000000000004 }, 'El precio admite hasta 2 decimales'],
      [{ price: '1e3' }, 'El precio no es un monto válido'],
      [{ price: '450,50' }, 'El precio no es un monto válido'],
      [{ unitCost: 'abc' }, 'El costo no es un monto válido'],
    ]
    for (const [overrides, message] of cases) {
      const name = uniqueName('money')
      const res = await createProductRoute(req(admin.token, validBody({ name, ...overrides })), undefined)
      expect(res.status, JSON.stringify(overrides)).toBe(422)
      expect(await res.json()).toMatchObject({ error: { message } })
      expect(await db.select().from(products).where(eq(products.name, name))).toHaveLength(0)
    }
  })

  it('dinero: acepta texto o número y guarda el texto normalizado', async () => {
    for (const price of ['450.5', 450.5]) {
      const res = await createProductRoute(req(admin.token, validBody({ price, unitCost: '83.3333' })), undefined)
      expect(res.status).toBe(201)
      expect(await res.json()).toMatchObject({ price: '450.50', unitCost: '83.3333' })
    }
  })

  it('dinero: precio igual al costo con otra escala se acepta; una diezmilésima menos se rechaza', async () => {
    const equal = await createProductRoute(req(admin.token, validBody({ price: '83.33', unitCost: '83.3300' })), undefined)
    expect(equal.status).toBe(201)
    const below = await createProductRoute(req(admin.token, validBody({ price: '83.33', unitCost: '83.3301' })), undefined)
    expect(below.status).toBe(422)
    expect(await below.json()).toMatchObject({ error: { message: 'El precio no puede ser menor que el costo' } })
  })
})
