import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getAuthContext } from '../src/auth/context'
import { requireRole } from '../src/auth/guards'
import { sql } from '../src/db/client'
import { AppError } from '../src/lib/errors'
import {
  cleanupTestData,
  createTestClient,
  createTestUser,
  hasServiceKey,
  type TestUser,
} from './helpers/users'

const withToken = (token?: string) =>
  new Request('http://api.test/api/me', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })

async function statusOf(promise: Promise<unknown>): Promise<number | null> {
  try {
    await promise
    return null
  } catch (err) {
    return err instanceof AppError ? err.status : -1
  }
}

// Necesitan SUPABASE_SERVICE_ROLE_KEY para crear cuentas de prueba en Auth.
describe.skipIf(!hasServiceKey)('getAuthContext y guards (con cuentas reales)', () => {
  let admin: TestUser
  let activeClient: TestUser
  let inactiveClient: TestUser
  let noProfile: TestUser
  let clientId: number

  beforeAll(async () => {
    await cleanupTestData()
    clientId = (await createTestClient('gym')).id
    admin = await createTestUser('admin', { role: 'admin' })
    activeClient = await createTestUser('client', { role: 'client', clientId })
    inactiveClient = await createTestUser('inactive', { role: 'client', clientId, active: false })
    noProfile = await createTestUser('noprofile', null)
  }, 60_000)

  afterAll(async () => {
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('un admin activo obtiene su contexto', async () => {
    const ctx = await getAuthContext(withToken(admin.token))
    expect(ctx).toMatchObject({ userId: admin.id, role: 'admin', clientId: null })
  })

  it('un cliente activo obtiene su contexto con su client_id', async () => {
    const ctx = await getAuthContext(withToken(activeClient.token))
    expect(ctx).toMatchObject({ userId: activeClient.id, role: 'client', clientId })
  })

  it('un cliente con active = false recibe 401 aunque el JWT siga vigente', async () => {
    expect(await statusOf(getAuthContext(withToken(inactiveClient.token)))).toBe(401)
  })

  it('un token válido sin perfil recibe 401', async () => {
    expect(await statusOf(getAuthContext(withToken(noProfile.token)))).toBe(401)
  })

  it('sin token, con token inválido o con esquema distinto a Bearer recibe 401', async () => {
    expect(await statusOf(getAuthContext(withToken()))).toBe(401)
    expect(await statusOf(getAuthContext(withToken('no-es-un-jwt')))).toBe(401)
    expect(
      await statusOf(
        getAuthContext(
          new Request('http://api.test/api/me', { headers: { authorization: `Basic ${admin.token}` } }),
        ),
      ),
    ).toBe(401)
  })

  it('requireRole: el admin pasa y el cliente recibe 403 en ruta de admin', async () => {
    expect(await statusOf(requireRole(withToken(admin.token), 'admin'))).toBeNull()
    expect(await statusOf(requireRole(withToken(activeClient.token), 'admin'))).toBe(403)
  })
})
