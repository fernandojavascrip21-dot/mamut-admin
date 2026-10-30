import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POST as loginRoute } from '@api/auth/login/route'
import { POST as deactivateRoute } from '@api/admins/[id]/deactivate/route'
import { POST as reactivateRoute } from '@api/admins/[id]/reactivate/route'
import { GET as listAdminsRoute, POST as createAdminRoute } from '@api/admins/route'
import { checkAdminDeactivation } from '@accounts'
import { db, sql } from '@db/client'
import { profiles } from '@db/schema'
import {
  cleanupTestData,
  createTestClient,
  createTestUser,
  hasServiceKey,
  TEST_PASSWORD,
  TEST_PREFIX,
  type TestUser,
} from './helpers/users'

const req = (method: string, token?: string, body?: unknown) =>
  new Request('http://api.test/api/admins', {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const email = (label: string) => `${TEST_PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`
const signIn = (e: string, password = TEST_PASSWORD) => loginRoute(req('POST', undefined, { email: e, password }), undefined)

describe('checkAdminDeactivation (regla pura)', () => {
  it('no permite desactivarse a sí mismo', () => {
    const err = checkAdminDeactivation({ targetId: 'a', actorId: 'a', activeAdminIds: ['a', 'b'] })
    expect(err?.status).toBe(409)
  })

  it('no permite desactivar al último administrador activo', () => {
    const err = checkAdminDeactivation({ targetId: 'b', actorId: 'a', activeAdminIds: ['b'] })
    expect(err?.status).toBe(409)
  })

  it('permite desactivar a otro si queda al menos un administrador activo', () => {
    expect(checkAdminDeactivation({ targetId: 'b', actorId: 'a', activeAdminIds: ['a', 'b'] })).toBeNull()
  })
})

describe.skipIf(!hasServiceKey)('administradores (con cuentas reales)', () => {
  let admin: TestUser
  let clientUser: TestUser

  async function newAdmin(label: string, extra: Record<string, unknown> = {}) {
    const body = { email: email(label), password: TEST_PASSWORD, fullName: `Admin ${label}`, ...extra }
    const res = await createAdminRoute(req('POST', admin.token, body), undefined)
    return { res, body }
  }

  beforeAll(async () => {
    await cleanupTestData()
    const clientId = (await createTestClient('gym')).id
    admin = await createTestUser('admin', { role: 'admin' })
    clientUser = await createTestUser('client', { role: 'client', clientId })
  }, 60_000)

  afterAll(async () => {
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('sin token da 401 y con token de cliente da 403 en todas las rutas', async () => {
    for (const call of [
      (t?: string) => listAdminsRoute(req('GET', t), undefined),
      (t?: string) => createAdminRoute(req('POST', t, { email: 'a@b.co', password: 'x', fullName: 'x' }), undefined),
      (t?: string) => deactivateRoute(req('POST', t), ctx(admin.id)),
      (t?: string) => reactivateRoute(req('POST', t), ctx(admin.id)),
    ]) {
      expect((await call()).status).toBe(401)
      expect((await call(clientUser.token)).status).toBe(403)
    }
  })

  it('un admin crea a otro: perfil con rol admin y sin client_id, y puede entrar', async () => {
    const { res, body } = await newAdmin('alta')
    expect(res.status).toBe(201)
    const created = await res.json()
    expect(created).toMatchObject({ clientId: null, fullName: body.fullName, email: body.email, active: true })

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, created.id))
    expect(profile).toMatchObject({ role: 'admin', clientId: null })

    const session = await signIn(body.email)
    expect(session.status).toBe(200)
    expect((await session.json()).user).toMatchObject({ role: 'admin', clientId: null })

    const list = await (await listAdminsRoute(req('GET', admin.token), undefined)).json()
    expect(list.some((a: { id: string }) => a.id === created.id)).toBe(true)
    expect(list.every((a: { clientId: number | null }) => a.clientId === null)).toBe(true)
  })

  it('correo repetido da 409; cuerpo inválido da 422', async () => {
    const first = await newAdmin('dup')
    const again = await createAdminRoute(req('POST', admin.token, { ...first.body, fullName: 'Otro' }), undefined)
    expect(again.status).toBe(409)
    expect((await newAdmin('corto', { password: 'corta' })).res.status).toBe(422)
    expect((await newAdmin('mail', { email: 'no-es-correo' })).res.status).toBe(422)
    expect((await createAdminRoute(req('POST', admin.token, { email: email('sin') }), undefined)).status).toBe(422)
  })

  it('un admin desactiva a otro (no puede entrar) y lo reactiva', async () => {
    const { res, body } = await newAdmin('toggle')
    const { id } = await res.json()

    const off = await deactivateRoute(req('POST', admin.token), ctx(id))
    expect(off.status).toBe(200)
    expect((await off.json()).active).toBe(false)
    expect((await signIn(body.email)).status).toBe(401)

    const on = await reactivateRoute(req('POST', admin.token), ctx(id))
    expect((await on.json()).active).toBe(true)
    expect((await signIn(body.email)).status).toBe(200)
  })

  it('un admin no puede desactivarse a sí mismo (409) y sigue activo', async () => {
    const res = await deactivateRoute(req('POST', admin.token), ctx(admin.id))
    expect(res.status).toBe(409)
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, admin.id))
    expect(profile?.active).toBe(true)
  })

  it('un id inexistente, mal formado o de un cliente da 404', async () => {
    expect((await deactivateRoute(req('POST', admin.token), ctx('no-es-uuid'))).status).toBe(404)
    expect((await deactivateRoute(req('POST', admin.token), ctx('00000000-0000-4000-8000-000000000000'))).status).toBe(404)
    expect((await deactivateRoute(req('POST', admin.token), ctx(clientUser.id))).status).toBe(404)
    expect((await reactivateRoute(req('POST', admin.token), ctx(clientUser.id))).status).toBe(404)
  })
})
