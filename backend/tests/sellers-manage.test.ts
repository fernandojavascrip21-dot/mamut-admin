import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POST as loginRoute } from '@api/auth/login/route'
import { POST as refreshRoute } from '@api/auth/refresh/route'
import { GET as meStockRoute } from '@api/me/stock/route'
import { POST as deactivateRoute } from '@api/sellers/[id]/deactivate/route'
import { PUT as passwordRoute } from '@api/sellers/[id]/password/route'
import { POST as reactivateRoute } from '@api/sellers/[id]/reactivate/route'
import { DELETE as deleteRoute, GET as getSellerRoute, PUT as updateRoute } from '@api/sellers/[id]/route'
import { GET as listRoute, POST as createRoute } from '@api/sellers/route'
import { normalizeBusinessName } from '@accounts'
import { db } from '@db/client'
import { products, profiles, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { insertMovements, type NewStockMovement } from '@stock'
import {
  cleanupTestData,
  createTestUser,
  hasServiceKey,
  TEST_PASSWORD,
  TEST_PREFIX,
  type TestUser,
} from './helpers/users'

// Productos de prueba con prefijo propio, para limpiarlos sin tocar el catálogo.
const PREFIX = 'test-manage-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`
const NEW_PASSWORD = 'Nueva-Clave-987!'
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000abcd'

interface CallOptions {
  token?: string
  body?: unknown
  query?: string
}

const request = (method: string, { token, body, query = '' }: CallOptions = {}) =>
  new Request(`http://api.test/api/sellers${query}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const json = async (res: Response) => (await res.json()) as Record<string, unknown>
const errorMessage = async (res: Response) => ((await json(res)).error as { message: string }).message

const authPost = (path: string, body: unknown) =>
  new Request(`http://api.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const meStock = (token: string) =>
  meStockRoute(new Request('http://api.test/api/me/stock', { headers: { authorization: `Bearer ${token}` } }), undefined)

const tryLogin = (email: string, password: string) =>
  loginRoute(authPost('/api/auth/login', { email, password }), undefined)

// Movimientos del más nuevo al más viejo (el trigger revierte cada uno), luego vendor_stock y
// productos. Va antes de cleanupTestData: vendor_stock apunta a los perfiles con FK `restrict`.
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

describe('normalizeBusinessName (regla pura)', () => {
  it('recorta los espacios de los extremos', () => {
    expect(normalizeBusinessName('  Café Centro  ')).toBe('Café Centro')
  })

  it('ausente, null o vacío dan null', () => {
    expect(normalizeBusinessName(undefined)).toBeNull()
    expect(normalizeBusinessName(null)).toBeNull()
    expect(normalizeBusinessName('')).toBeNull()
    expect(normalizeBusinessName('   ')).toBeNull()
  })

  it('80 caracteres pasan y 81 dan 422', () => {
    expect(normalizeBusinessName('a'.repeat(80))).toBe('a'.repeat(80))
    expect(() => normalizeBusinessName('a'.repeat(81))).toThrowError(
      expect.objectContaining({
        status: 422,
        message: 'El nombre del negocio debe tener como máximo 80 caracteres',
      }),
    )
  })
})

describe.skipIf(!hasServiceKey)('Gestión de vendedores (M13-t42, con cuentas reales)', () => {
  let admin: TestUser
  let otherAdmin: TestUser
  let seller: TestUser
  let product: number

  const move = (rows: Omit<NewStockMovement, 'createdBy'>[]) =>
    withTransaction((tx) => insertMovements(tx, rows.map((row) => ({ ...row, createdBy: admin.id }))))

  // Entrega y retiro reales: dos filas por movimiento, en la misma transacción.
  const deliver = (holder: string, qty: number) =>
    move([
      { productId: product, type: 'delivery', qty: -qty, holderProfileId: null },
      { productId: product, type: 'delivery', qty, holderProfileId: holder },
    ])
  const takeBack = (holder: string, qty: number) =>
    move([
      { productId: product, type: 'return', qty, holderProfileId: null },
      { productId: product, type: 'return', qty: -qty, holderProfileId: holder },
    ])

  const newSeller = (label: string, active = true) => createTestUser(label, { role: 'vendedor', active })
  const isActive = async (id: string) =>
    (await db.select({ active: profiles.active }).from(profiles).where(eq(profiles.id, id)))[0]?.active
  const profileExists = async (id: string) =>
    (await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, id))).length === 1

  const update = (id: string, body: unknown, token = admin.token) =>
    updateRoute(request('PUT', { token, body }), ctx(id))
  const fullBody = (overrides: Record<string, unknown> = {}) => ({
    fullName: 'Luis Pérez',
    businessName: 'Gimnasio Sur',
    phone: '55 1234 5678',
    email: `${TEST_PREFIX}edit-${Date.now()}-${Math.floor(Math.random() * 1e5)}@example.com`,
    ...overrides,
  })

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    admin = await createTestUser('m42-admin', { role: 'admin' })
    otherAdmin = await createTestUser('m42-otro-admin', { role: 'admin' })
    seller = await newSeller('m42-vendedor')
    const [row] = await db.insert(products)
      .values({ name: productName('whey'), price: '100', unitCost: '50' }).returning()
    product = row!.id
    await move([{ productId: product, type: 'initial', qty: 50, holderProfileId: null }])
  })

  afterAll(async () => {
    await cleanupStock()
    await cleanupTestData()
  })

  describe('alta con negocio', () => {
    it('POST con businessName con espacios lo guarda recortado', async () => {
      const email = `${TEST_PREFIX}alta-${Date.now()}@example.com`
      const res = await createRoute(
        request('POST', {
          token: admin.token,
          body: { email, password: TEST_PASSWORD, fullName: 'Ana', phone: '5511112222', businessName: '  Café Centro  ' },
        }),
        undefined,
      )
      expect(res.status).toBe(201)
      expect((await json(res)).businessName).toBe('Café Centro')
    })

    it('POST sin businessName lo crea con null', async () => {
      const email = `${TEST_PREFIX}alta-sin-${Date.now()}@example.com`
      const res = await createRoute(
        request('POST', { token: admin.token, body: { email, password: TEST_PASSWORD, fullName: 'Beto', phone: '5511112222' } }),
        undefined,
      )
      expect(res.status).toBe(201)
      expect((await json(res)).businessName).toBeNull()
    })

    it('POST con negocio de 81 caracteres da 422', async () => {
      const email = `${TEST_PREFIX}alta-largo-${Date.now()}@example.com`
      const res = await createRoute(
        request('POST', {
          token: admin.token,
          body: { email, password: TEST_PASSWORD, fullName: 'Caro', phone: '5511112222', businessName: 'a'.repeat(81) },
        }),
        undefined,
      )
      expect(res.status).toBe(422)
    })
  })

  describe('listar y abrir', () => {
    it('GET sin status devuelve solo activos y cada fila trae businessName', async () => {
      const inactive = await newSeller('m42-lista-inactivo', false)
      const res = await listRoute(request('GET', { token: admin.token }), undefined)
      expect(res.status).toBe(200)
      const rows = (await res.json()) as { id: string; businessName: string | null }[]
      expect(rows.some((row) => row.id === seller.id)).toBe(true)
      expect(rows.some((row) => row.id === inactive.id)).toBe(false)
      expect(rows.every((row) => 'businessName' in row)).toBe(true)
    })

    it('GET ?status=inactive devuelve solo desactivados', async () => {
      const inactive = await newSeller('m42-lista-inactivo2', false)
      const res = await listRoute(request('GET', { token: admin.token, query: '?status=inactive' }), undefined)
      expect(res.status).toBe(200)
      const rows = (await res.json()) as { id: string; businessName: string | null }[]
      expect(rows.some((row) => row.id === inactive.id)).toBe(true)
      expect(rows.some((row) => row.id === seller.id)).toBe(false)
      expect(rows.every((row) => 'businessName' in row)).toBe(true)
    })

    it('GET ?status=otro da 422', async () => {
      const res = await listRoute(request('GET', { token: admin.token, query: '?status=otro' }), undefined)
      expect(res.status).toBe(422)
    })

    it('GET del detalle de un desactivado da 404 y con ?status=any da 200 con active false', async () => {
      const inactive = await newSeller('m42-detalle-inactivo', false)
      const plain = await getSellerRoute(request('GET', { token: admin.token }), ctx(inactive.id))
      expect(plain.status).toBe(404)
      const any = await getSellerRoute(request('GET', { token: admin.token, query: '?status=any' }), ctx(inactive.id))
      expect(any.status).toBe(200)
      const body = await json(any)
      expect(body.active).toBe(false)
      expect(body).toHaveProperty('businessName')
    })

    it('GET ?status=any también abre a un activo, con su negocio', async () => {
      const res = await getSellerRoute(request('GET', { token: admin.token, query: '?status=any' }), ctx(seller.id))
      expect(res.status).toBe(200)
      expect((await json(res)).active).toBe(true)
    })
  })

  describe('editar', () => {
    it('cambia nombre, negocio y teléfono; «55 1234 5678» se guarda como 5512345678', async () => {
      const target = await newSeller('m42-editar')
      const res = await update(target.id, fullBody({ email: target.email }))
      expect(res.status).toBe(200)
      const body = await json(res)
      expect(body).toMatchObject({ fullName: 'Luis Pérez', businessName: 'Gimnasio Sur', phone: '5512345678', email: target.email })
    })

    it('con un correo nuevo entra con ese y ya no con el anterior', async () => {
      const target = await newSeller('m42-correo')
      const email = `${TEST_PREFIX}nuevo-${Date.now()}@example.com`
      const res = await update(target.id, fullBody({ email }))
      expect(res.status).toBe(200)
      expect((await json(res)).email).toBe(email)
      expect((await tryLogin(email, TEST_PASSWORD)).status).toBe(200)
      expect((await tryLogin(target.email, TEST_PASSWORD)).status).toBe(401)
    })

    it('con el correo de otra cuenta da 409 y no cambia nada', async () => {
      const target = await newSeller('m42-duplicado')
      const res = await update(target.id, fullBody({ email: otherAdmin.email, fullName: 'No debe guardarse' }))
      expect(res.status).toBe(409)
      expect(await errorMessage(res)).toBe('Ya existe un acceso con ese correo')
      expect((await tryLogin(target.email, TEST_PASSWORD)).status).toBe(200)
      const [row] = await db.select({ fullName: profiles.fullName }).from(profiles).where(eq(profiles.id, target.id))
      expect(row?.fullName).not.toBe('No debe guardarse')
    })

    it('con teléfono inválido da 422 y no cambia el correo en Auth', async () => {
      const target = await newSeller('m42-telefono')
      const res = await update(target.id, fullBody({ phone: '123' }))
      expect(res.status).toBe(422)
      expect((await tryLogin(target.email, TEST_PASSWORD)).status).toBe(200)
    })

    it('con el nombre vacío da 422 y no cambia el correo en Auth', async () => {
      const target = await newSeller('m42-nombre')
      const res = await update(target.id, fullBody({ fullName: '   ' }))
      expect(res.status).toBe(422)
      expect((await tryLogin(target.email, TEST_PASSWORD)).status).toBe(200)
    })

    it('con negocio de 81 caracteres o correo inválido da 422', async () => {
      const target = await newSeller('m42-negocio-largo')
      expect((await update(target.id, fullBody({ businessName: 'a'.repeat(81) }))).status).toBe(422)
      expect((await update(target.id, fullBody({ email: 'no-es-correo' }))).status).toBe(422)
    })

    it('funciona con un vendedor desactivado', async () => {
      const target = await newSeller('m42-editar-inactivo', false)
      const res = await update(target.id, fullBody({ email: target.email }))
      expect(res.status).toBe(200)
      expect((await json(res)).active).toBe(false)
    })
  })

  describe('desactivar y reactivar', () => {
    it('con piezas a su cargo da 409 y sigue activo', async () => {
      const target = await newSeller('m42-con-piezas')
      await deliver(target.id, 3)
      const res = await deactivateRoute(request('POST', { token: admin.token }), ctx(target.id))
      expect(res.status).toBe(409)
      expect(await errorMessage(res)).toBe('Retírale sus piezas antes de desactivarlo')
      expect(await isActive(target.id)).toBe(true)
    })

    it('sin piezas lo deja inactivo, su token da 401 y su login falla; reactivarlo le devuelve el acceso', async () => {
      const target = await newSeller('m42-desactivar')
      const res = await deactivateRoute(request('POST', { token: admin.token }), ctx(target.id))
      expect(res.status).toBe(200)
      expect((await json(res)).active).toBe(false)
      expect((await meStock(target.token)).status).toBe(401)
      expect((await tryLogin(target.email, TEST_PASSWORD)).status).toBe(401)

      const back = await reactivateRoute(request('POST', { token: admin.token }), ctx(target.id))
      expect(back.status).toBe(200)
      expect((await json(back)).active).toBe(true)
      expect((await tryLogin(target.email, TEST_PASSWORD)).status).toBe(200)
    })

    it('tras retirarle sus piezas ya se puede desactivar', async () => {
      const target = await newSeller('m42-retirado')
      await deliver(target.id, 2)
      await takeBack(target.id, 2)
      const res = await deactivateRoute(request('POST', { token: admin.token }), ctx(target.id))
      expect(res.status).toBe(200)
    })

    it('desactivar a uno desactivado o reactivar a uno activo responde 200 sin cambios', async () => {
      const inactive = await newSeller('m42-idem-inactivo', false)
      const again = await deactivateRoute(request('POST', { token: admin.token }), ctx(inactive.id))
      expect(again.status).toBe(200)
      expect((await json(again)).active).toBe(false)

      const active = await newSeller('m42-idem-activo')
      const same = await reactivateRoute(request('POST', { token: admin.token }), ctx(active.id))
      expect(same.status).toBe(200)
      expect((await json(same)).active).toBe(true)
    })
  })

  describe('eliminar', () => {
    it('un vendedor sin movimientos da 204 y se borran su perfil y su cuenta de Auth', async () => {
      const target = await newSeller('m42-eliminar')
      const res = await deleteRoute(request('DELETE', { token: admin.token }), ctx(target.id))
      expect(res.status).toBe(204)
      expect(await profileExists(target.id)).toBe(false)
      expect((await tryLogin(target.email, TEST_PASSWORD)).status).toBe(401)
    })

    it('funciona con un vendedor desactivado sin historial', async () => {
      const target = await newSeller('m42-eliminar-inactivo', false)
      expect((await deleteRoute(request('DELETE', { token: admin.token }), ctx(target.id))).status).toBe(204)
    })

    it('con un delivery y su return (piezas en 0) da 409 y no borra nada', async () => {
      const target = await newSeller('m42-historial')
      await deliver(target.id, 2)
      await takeBack(target.id, 2)
      const res = await deleteRoute(request('DELETE', { token: admin.token }), ctx(target.id))
      expect(res.status).toBe(409)
      expect(await errorMessage(res)).toBe('Tiene historial: solo se puede desactivar')
      expect(await profileExists(target.id)).toBe(true)
      expect((await tryLogin(target.email, TEST_PASSWORD)).status).toBe(200)
    })
  })

  describe('contraseña temporal', () => {
    it('con 7 caracteres da 422', async () => {
      const target = await newSeller('m42-clave-corta')
      const res = await passwordRoute(request('PUT', { token: admin.token, body: { password: '1234567' } }), ctx(target.id))
      expect(res.status).toBe(422)
    })

    it('con una válida da 200, la anterior deja de servir y la nueva sí', async () => {
      const target = await newSeller('m42-clave')
      const res = await passwordRoute(request('PUT', { token: admin.token, body: { password: NEW_PASSWORD } }), ctx(target.id))
      expect(res.status).toBe(200)
      expect(await json(res)).toEqual({ emailStatus: expect.stringMatching(/^(sent|failed|skipped)$/) })
      expect((await tryLogin(target.email, TEST_PASSWORD)).status).toBe(401)
      expect((await tryLogin(target.email, NEW_PASSWORD)).status).toBe(200)
    })

    it('el token y el refresh token anteriores dan 401', async () => {
      const target = await newSeller('m42-sesiones')
      expect((await meStock(target.token)).status).toBe(200)
      const res = await passwordRoute(request('PUT', { token: admin.token, body: { password: NEW_PASSWORD } }), ctx(target.id))
      expect(res.status).toBe(200)
      expect((await meStock(target.token)).status).toBe(401)
      const refreshed = await refreshRoute(authPost('/api/auth/refresh', { refreshToken: target.refreshToken }), undefined)
      expect(refreshed.status).toBe(401)
    })

    it('funciona con un vendedor desactivado', async () => {
      const target = await newSeller('m42-clave-inactivo', false)
      const res = await passwordRoute(request('PUT', { token: admin.token, body: { password: NEW_PASSWORD } }), ctx(target.id))
      expect(res.status).toBe(200)
    })
  })

  describe('permisos y ids inválidos en las rutas nuevas', () => {
    type Call = (id: string, token?: string) => Promise<Response>
    const routes: [string, Call][] = [
      ['PUT /api/sellers/[id]', (id, token) => updateRoute(request('PUT', { token, body: fullBody() }), ctx(id))],
      ['POST deactivate', (id, token) => deactivateRoute(request('POST', { token }), ctx(id))],
      ['POST reactivate', (id, token) => reactivateRoute(request('POST', { token }), ctx(id))],
      ['DELETE /api/sellers/[id]', (id, token) => deleteRoute(request('DELETE', { token }), ctx(id))],
      ['PUT password', (id, token) => passwordRoute(request('PUT', { token, body: { password: NEW_PASSWORD } }), ctx(id))],
    ]

    it.each(routes)('%s: sin sesión da 401', async (_name, call) => {
      expect((await call(seller.id)).status).toBe(401)
    })

    it.each(routes)('%s: un vendedor recibe 403', async (_name, call) => {
      expect((await call(seller.id, seller.token)).status).toBe(403)
    })

    it.each(routes)('%s: un administrador, un UUID inexistente o un id sin forma de UUID dan 404', async (_name, call) => {
      expect((await call(otherAdmin.id, admin.token)).status).toBe(404)
      expect((await call(UNKNOWN_ID, admin.token)).status).toBe(404)
      expect((await call('no-es-uuid', admin.token)).status).toBe(404)
    })

    it('GET ?status=any con id de administrador o inexistente da 404', async () => {
      const query = '?status=any'
      expect((await getSellerRoute(request('GET', { token: admin.token, query }), ctx(otherAdmin.id))).status).toBe(404)
      expect((await getSellerRoute(request('GET', { token: admin.token, query }), ctx(UNKNOWN_ID))).status).toBe(404)
    })
  })
})
