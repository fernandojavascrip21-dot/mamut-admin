import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POST as login } from '@api/auth/login/route'
import { GET as me } from '@api/me/route'
import { sql } from '@db/client'
import { cleanupTestData, createTestUser, hasServiceKey, TEST_PASSWORD, type TestUser } from './helpers/users'

const post = (path: string, body: unknown) =>
  new Request(`http://api.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const getMe = (token: string) =>
  new Request('http://api.test/api/me', { headers: { authorization: `Bearer ${token}` } })

describe.skipIf(!hasServiceKey)('rol vendedor (con cuentas reales)', () => {
  let vendedor: TestUser

  beforeAll(async () => {
    await cleanupTestData()
    vendedor = await createTestUser('vendedor', { role: 'vendedor' })
  }, 60_000)

  afterAll(async () => {
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('un perfil vendedor activo puede loguearse y /api/me devuelve su rol', async () => {
    const res = await login(post('/api/auth/login', { email: vendedor.email, password: TEST_PASSWORD }), undefined)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user).toMatchObject({ userId: vendedor.id, role: 'vendedor', clientId: null })

    const meRes = await me(getMe(body.accessToken), undefined)
    expect(meRes.status).toBe(200)
    expect(await meRes.json()).toMatchObject({ userId: vendedor.id, role: 'vendedor' })
  })

  it('un perfil vendedor inactivo recibe el mismo 401 genérico al intentar loguearse', async () => {
    const inactive = await createTestUser('vendedor-inactivo', { role: 'vendedor', active: false })
    const res = await login(post('/api/auth/login', { email: inactive.email, password: TEST_PASSWORD }), undefined)
    expect(res.status).toBe(401)
    expect((await res.json()).error.message).toBe('Correo o contraseña incorrectos')
  })
})
