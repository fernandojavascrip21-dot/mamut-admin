import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as getClientRoute, DELETE as deleteClientRoute, PATCH as patchClientRoute } from '../app/api/clients/[id]/route'
import { POST as deactivateRoute } from '../app/api/clients/[id]/deactivate/route'
import { POST as reactivateRoute } from '../app/api/clients/[id]/reactivate/route'
import { GET as listClientsRoute, POST as createClientRoute } from '../app/api/clients/route'
import { db, sql } from '../src/db/client'
import { clients, debtors, profiles } from '../src/db/schema'
import { cleanupTestData, createTestUser, hasServiceKey, TEST_PREFIX, type TestUser } from './helpers/users'

const req = (method: string, token?: string, body?: unknown) =>
  new Request('http://api.test/api/clients', {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const ctx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) })
const uniqueName = (label: string) => `${TEST_PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`

describe.skipIf(!hasServiceKey)('clientes (con cuentas reales)', () => {
  let admin: TestUser
  let clientUser: TestUser
  let clientId: number

  async function newClient(label: string) {
    const res = await createClientRoute(req('POST', admin.token, { name: uniqueName(label) }), undefined)
    expect(res.status).toBe(201)
    return (await res.json()) as { id: number; name: string; active: boolean }
  }

  beforeAll(async () => {
    await cleanupTestData()
    admin = await createTestUser('admin', { role: 'admin' })
    const own = await newClient('own')
    clientId = own.id
    clientUser = await createTestUser('client', { role: 'client', clientId })
  }, 60_000)

  afterAll(async () => {
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('sin token da 401 y con token de cliente da 403 en todas las rutas', async () => {
    for (const call of [
      (t?: string) => listClientsRoute(req('GET', t), undefined),
      (t?: string) => createClientRoute(req('POST', t, { name: 'x' }), undefined),
      (t?: string) => getClientRoute(req('GET', t), ctx(clientId)),
      (t?: string) => patchClientRoute(req('PATCH', t, { notes: 'x' }), ctx(clientId)),
      (t?: string) => deactivateRoute(req('POST', t), ctx(clientId)),
      (t?: string) => reactivateRoute(req('POST', t), ctx(clientId)),
      (t?: string) => deleteClientRoute(req('DELETE', t), ctx(clientId)),
    ]) {
      expect((await call()).status).toBe(401)
      expect((await call(clientUser.token)).status).toBe(403)
    }
  })

  it('el admin crea, lee, lista y edita un cliente', async () => {
    const created = await newClient('crud')
    expect(created.active).toBe(true)

    const got = await getClientRoute(req('GET', admin.token), ctx(created.id))
    expect((await got.json()).name).toBe(created.name)

    const list = await (await listClientsRoute(req('GET', admin.token), undefined)).json()
    expect(list.some((c: { id: number }) => c.id === created.id)).toBe(true)

    const patched = await patchClientRoute(
      req('PATCH', admin.token, { phone: ' 3312345678 ', notes: null }),
      ctx(created.id),
    )
    expect(patched.status).toBe(200)
    expect(await patched.json()).toMatchObject({ phone: '3312345678', notes: null })
  })

  it('nombre repetido da 409 al crear y al editar', async () => {
    const a = await newClient('dup-a')
    const b = await newClient('dup-b')
    expect((await createClientRoute(req('POST', admin.token, { name: a.name }), undefined)).status).toBe(409)
    expect((await patchClientRoute(req('PATCH', admin.token, { name: a.name }), ctx(b.id))).status).toBe(409)
  })

  it('valida el cuerpo: sin nombre 422, nombre vacío en PATCH 422, PATCH vacío 422', async () => {
    expect((await createClientRoute(req('POST', admin.token, { phone: '1' }), undefined)).status).toBe(422)
    expect((await patchClientRoute(req('PATCH', admin.token, { name: '  ' }), ctx(clientId))).status).toBe(422)
    expect((await patchClientRoute(req('PATCH', admin.token, {}), ctx(clientId))).status).toBe(422)
  })

  it('un id inexistente o mal formado da 404', async () => {
    expect((await getClientRoute(req('GET', admin.token), ctx(999999999))).status).toBe(404)
    expect((await getClientRoute(req('GET', admin.token), ctx('abc'))).status).toBe(404)
    expect((await deactivateRoute(req('POST', admin.token), ctx(999999999))).status).toBe(404)
    expect((await deleteClientRoute(req('DELETE', admin.token), ctx(999999999))).status).toBe(404)
  })

  it('desactivar desactiva sus logins; reactivar el cliente no los reactiva', async () => {
    const c = await newClient('toggle')
    const login = await createTestUser('toggle-login', { role: 'client', clientId: c.id })

    const off = await deactivateRoute(req('POST', admin.token), ctx(c.id))
    expect((await off.json()).active).toBe(false)
    const [profileOff] = await db.select().from(profiles).where(eq(profiles.id, login.id))
    expect(profileOff?.active).toBe(false)

    const on = await reactivateRoute(req('POST', admin.token), ctx(c.id))
    expect((await on.json()).active).toBe(true)
    const [profileStill] = await db.select().from(profiles).where(eq(profiles.id, login.id))
    expect(profileStill?.active).toBe(false)
  })

  it('borra un cliente sin historial ni logins (204) y luego da 404', async () => {
    const c = await newClient('empty')
    expect((await deleteClientRoute(req('DELETE', admin.token), ctx(c.id))).status).toBe(204)
    expect((await getClientRoute(req('GET', admin.token), ctx(c.id))).status).toBe(404)
  })

  it('un cliente con logins o con historial da 409 y no se borra nada', async () => {
    const withLogin = await newClient('with-login')
    await createTestUser('del-login', { role: 'client', clientId: withLogin.id })
    expect((await deleteClientRoute(req('DELETE', admin.token), ctx(withLogin.id))).status).toBe(409)

    const withHistory = await newClient('with-history')
    await db.insert(debtors).values({
      clientId: withHistory.id,
      name: uniqueName('deudor'),
      phone: '3300000000',
      createdBy: admin.id,
    })
    const res = await deleteClientRoute(req('DELETE', admin.token), ctx(withHistory.id))
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('conflict')

    for (const c of [withLogin, withHistory]) {
      const [row] = await db.select().from(clients).where(eq(clients.id, c.id))
      expect(row).toBeTruthy()
    }
  })
})
