import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { POST as loginRoute } from '@api/auth/login/route'
import { GET as listLoginsRoute, POST as createLoginRoute } from '@api/clients/[id]/logins/route'
import { POST as deactivateClientRoute } from '@api/clients/[id]/deactivate/route'
import { POST as deactivateRoute } from '@api/logins/[id]/deactivate/route'
import { POST as passwordRoute } from '@api/logins/[id]/password/route'
import { POST as reactivateRoute } from '@api/logins/[id]/reactivate/route'
import { DELETE as deleteLoginRoute, PATCH as patchLoginRoute } from '@api/logins/[id]/route'
import { db, sql } from '@db/client'
import { debtors, profiles } from '@db/schema'
import { supabaseAdmin } from '@lib/supabase'
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
  new Request('http://api.test/api/x', {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const ctx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) })
const email = (label: string) => `${TEST_PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`

const signIn = (e: string, password: string) =>
  loginRoute(req('POST', undefined, { email: e, password }), undefined)

describe.skipIf(!hasServiceKey)('logins de cliente (con cuentas reales)', () => {
  let admin: TestUser
  let clientUser: TestUser
  let clientId: number

  async function newLogin(label: string, extra: Record<string, unknown> = {}) {
    const body = { email: email(label), password: TEST_PASSWORD, fullName: `Persona ${label}`, ...extra }
    const res = await createLoginRoute(req('POST', admin.token, body), ctx(clientId))
    return { res, body }
  }

  beforeAll(async () => {
    await cleanupTestData()
    clientId = (await createTestClient('gym')).id
    admin = await createTestUser('admin', { role: 'admin' })
    clientUser = await createTestUser('client', { role: 'client', clientId })
  }, 60_000)

  afterAll(async () => {
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('sin token da 401 y con token de cliente da 403 en todas las rutas', async () => {
    const id = clientUser.id
    for (const call of [
      (t?: string) => listLoginsRoute(req('GET', t), ctx(clientId)),
      (t?: string) => createLoginRoute(req('POST', t, { email: 'a@b.co', password: 'x', fullName: 'x' }), ctx(clientId)),
      (t?: string) => patchLoginRoute(req('PATCH', t, { fullName: 'x' }), ctx(id)),
      (t?: string) => deactivateRoute(req('POST', t), ctx(id)),
      (t?: string) => reactivateRoute(req('POST', t), ctx(id)),
      (t?: string) => passwordRoute(req('POST', t, { password: 'Nueva-12345' }), ctx(id)),
      (t?: string) => deleteLoginRoute(req('DELETE', t), ctx(id)),
    ]) {
      expect((await call()).status).toBe(401)
      expect((await call(clientUser.token)).status).toBe(403)
    }
  })

  it('crea un login con rol cliente y client_id del cliente, y la persona puede entrar', async () => {
    const { res, body } = await newLogin('alta')
    expect(res.status).toBe(201)
    const login = await res.json()
    expect(login).toMatchObject({ clientId, fullName: body.fullName, email: body.email, active: true })

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, login.id))
    expect(profile).toMatchObject({ role: 'client', clientId })

    const session = await signIn(body.email, TEST_PASSWORD)
    expect(session.status).toBe(200)
    expect((await session.json()).user).toMatchObject({ role: 'client', clientId })

    const list = await (await listLoginsRoute(req('GET', admin.token), ctx(clientId))).json()
    expect(list.some((l: { id: string }) => l.id === login.id)).toBe(true)
  })

  it('un login nuevo de un cliente desactivado nace desactivado y no puede entrar', async () => {
    const off = await createTestClient('off')
    await deactivateClientRoute(req('POST', admin.token), ctx(off.id))
    const body = { email: email('nace-off'), password: TEST_PASSWORD, fullName: 'Persona off' }
    const res = await createLoginRoute(req('POST', admin.token, body), ctx(off.id))
    expect(res.status).toBe(201)
    expect((await res.json()).active).toBe(false)
    expect((await signIn(body.email, TEST_PASSWORD)).status).toBe(401)
  })

  it('correo repetido da 409', async () => {
    const first = await newLogin('dup')
    const again = await createLoginRoute(
      req('POST', admin.token, { ...first.body, fullName: 'Otra persona' }),
      ctx(clientId),
    )
    expect(again.status).toBe(409)
  })

  it('pedir otro rol da 422; cuerpo inválido da 422; cliente inexistente da 404', async () => {
    expect((await newLogin('rol', { role: 'admin' })).res.status).toBe(422)
    expect((await newLogin('corto', { password: 'corta' })).res.status).toBe(422)
    expect((await newLogin('mail', { email: 'no-es-correo' })).res.status).toBe(422)
    expect(
      (await createLoginRoute(req('POST', admin.token, { email: email('x'), password: TEST_PASSWORD, fullName: 'x' }), ctx(999999999))).status,
    ).toBe(404)
  })

  it('si falla el insert en profiles se borra la cuenta de Auth (sin huérfanas)', async () => {
    const target = email('huerfana')
    const spy = vi.spyOn(db, 'insert').mockImplementationOnce(() => {
      throw new Error('fallo simulado del insert')
    })
    const res = await createLoginRoute(
      req('POST', admin.token, { email: target, password: TEST_PASSWORD, fullName: 'Huérfana' }),
      ctx(clientId),
    )
    spy.mockRestore()
    expect(res.status).toBe(500)

    const { data } = await supabaseAdmin().auth.admin.listUsers({ perPage: 200 })
    expect(data.users.some((u) => u.email === target)).toBe(false)
  })

  it('el admin asigna contraseña nueva: entra con la nueva y la anterior deja de servir', async () => {
    const { res, body } = await newLogin('pass')
    const { id } = await res.json()

    const bad = await passwordRoute(req('POST', admin.token, { password: 'corta' }), ctx(id))
    expect(bad.status).toBe(422)

    const ok = await passwordRoute(req('POST', admin.token, { password: 'Nueva-12345!' }), ctx(id))
    expect(ok.status).toBe(204)
    expect((await signIn(body.email, 'Nueva-12345!')).status).toBe(200)
    expect((await signIn(body.email, TEST_PASSWORD)).status).toBe(401)
  })

  it('desactivar bloquea la entrada y reactivar la devuelve; PATCH cambia el nombre', async () => {
    const { res, body } = await newLogin('toggle')
    const { id } = await res.json()

    expect((await (await deactivateRoute(req('POST', admin.token), ctx(id))).json()).active).toBe(false)
    expect((await signIn(body.email, TEST_PASSWORD)).status).toBe(401)

    expect((await (await reactivateRoute(req('POST', admin.token), ctx(id))).json()).active).toBe(true)
    expect((await signIn(body.email, TEST_PASSWORD)).status).toBe(200)

    const patched = await patchLoginRoute(req('PATCH', admin.token, { fullName: ' Nombre nuevo ' }), ctx(id))
    expect((await patched.json()).fullName).toBe('Nombre nuevo')
    expect((await patchLoginRoute(req('PATCH', admin.token, {}), ctx(id))).status).toBe(422)
  })

  it('un id inexistente, mal formado o de un administrador da 404', async () => {
    expect((await deactivateRoute(req('POST', admin.token), ctx('no-es-uuid'))).status).toBe(404)
    expect((await deactivateRoute(req('POST', admin.token), ctx('00000000-0000-4000-8000-000000000000'))).status).toBe(404)
    expect((await deactivateRoute(req('POST', admin.token), ctx(admin.id))).status).toBe(404)
  })

  it('borrar un login sin historial da 204, elimina su cuenta de Auth y deja de entrar', async () => {
    const { res, body } = await newLogin('borrar')
    const { id } = await res.json()

    expect((await deleteLoginRoute(req('DELETE', admin.token), ctx(id))).status).toBe(204)
    expect((await db.select().from(profiles).where(eq(profiles.id, id))).length).toBe(0)
    const { data } = await supabaseAdmin().auth.admin.getUserById(id)
    expect(data.user).toBeNull()
    expect((await signIn(body.email, TEST_PASSWORD)).status).toBe(401)
  })

  it('borrar un login con historial da 409 y no borra nada', async () => {
    const { res, body } = await newLogin('historial')
    const { id } = await res.json()
    await db.insert(debtors).values({ clientId, name: `${TEST_PREFIX}deudor-${Date.now()}`, phone: '3300000000', createdBy: id })

    const del = await deleteLoginRoute(req('DELETE', admin.token), ctx(id))
    expect(del.status).toBe(409)
    expect((await db.select().from(profiles).where(eq(profiles.id, id))).length).toBe(1)
    expect((await signIn(body.email, TEST_PASSWORD)).status).toBe(200)
  })
})
