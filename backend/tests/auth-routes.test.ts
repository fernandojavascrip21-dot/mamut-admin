import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POST as login } from '@api/auth/login/route'
import { POST as logout } from '@api/auth/logout/route'
import { POST as refresh } from '@api/auth/refresh/route'
import { GET as me } from '@api/me/route'
import { sql } from '@db/client'
import {
  cleanupTestData,
  createTestClient,
  createTestUser,
  hasServiceKey,
  TEST_PASSWORD,
  type TestUser,
} from './helpers/users'

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://api.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

const getMe = (token?: string) =>
  new Request('http://api.test/api/me', { headers: token ? { authorization: `Bearer ${token}` } : {} })

describe.skipIf(!hasServiceKey)('rutas de sesión (con cuentas reales)', () => {
  let admin: TestUser
  let inactiveClient: TestUser

  beforeAll(async () => {
    await cleanupTestData()
    const clientId = (await createTestClient('gym')).id
    admin = await createTestUser('admin', { role: 'admin' })
    inactiveClient = await createTestUser('inactive', { role: 'client', clientId, active: false })
  }, 60_000)

  afterAll(async () => {
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('login correcto devuelve tokens y el usuario; /api/me responde con ese token', async () => {
    const res = await login(post('/api/auth/login', { email: admin.email, password: TEST_PASSWORD }), undefined)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.accessToken).toBeTruthy()
    expect(body.refreshToken).toBeTruthy()
    expect(body.user).toMatchObject({ userId: admin.id, role: 'admin', clientId: null })

    const meRes = await me(getMe(body.accessToken), undefined)
    expect(meRes.status).toBe(200)
    expect(await meRes.json()).toMatchObject({ userId: admin.id, role: 'admin' })
  })

  it('correo inexistente, contraseña incorrecta y acceso desactivado dan la misma respuesta', async () => {
    const attempts = [
      { email: 'no-existe-xyz@example.com', password: 'cualquiera-123' },
      { email: admin.email, password: 'contraseña-equivocada' },
      { email: inactiveClient.email, password: TEST_PASSWORD },
    ]
    const results = await Promise.all(
      attempts.map(async (a) => {
        const res = await login(post('/api/auth/login', a), undefined)
        return { status: res.status, body: await res.json() }
      }),
    )
    for (const r of results) expect(r.status).toBe(401)
    expect(results[1]).toEqual(results[0])
    expect(results[2]).toEqual(results[0])
  })

  it('login con cuerpo incompleto o no JSON responde 422', async () => {
    expect((await login(post('/api/auth/login', { email: admin.email }), undefined)).status).toBe(422)
    expect((await login(post('/api/auth/login', 'no es json'), undefined)).status).toBe(422)
  })

  it('refresh con un refreshToken válido entrega tokens nuevos; con uno inválido da 401', async () => {
    const ok = await refresh(post('/api/auth/refresh', { refreshToken: admin.refreshToken }), undefined)
    expect(ok.status).toBe(200)
    expect((await ok.json()).accessToken).toBeTruthy()

    const bad = await refresh(post('/api/auth/refresh', { refreshToken: 'invalido' }), undefined)
    expect(bad.status).toBe(401)
  })

  it('/api/me sin token responde 401', async () => {
    expect((await me(getMe(), undefined)).status).toBe(401)
  })

  it('logout responde 204 y el token deja de servir', async () => {
    const fresh = await login(post('/api/auth/login', { email: admin.email, password: TEST_PASSWORD }), undefined)
    const { accessToken } = await fresh.json()

    const out = await logout(post('/api/auth/logout', {}, { authorization: `Bearer ${accessToken}` }), undefined)
    expect(out.status).toBe(204)
    expect((await me(getMe(accessToken), undefined)).status).toBe(401)
  })

  it('logout sin token responde 401', async () => {
    expect((await logout(post('/api/auth/logout', {}), undefined)).status).toBe(401)
  })
})
