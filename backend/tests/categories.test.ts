import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as listCategoriesRoute } from '../app/api/categories/route'
import { sql } from '../src/db/client'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const req = (token?: string) =>
  new Request('http://api.test/api/categories', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })

describe.skipIf(!hasServiceKey)('categorías (con cuentas reales)', () => {
  let admin: TestUser
  let vendedor: TestUser

  beforeAll(async () => {
    await cleanupTestData()
    admin = await createTestUser('cat-admin', { role: 'admin' })
    vendedor = await createTestUser('cat-vendedor', { role: 'vendedor' })
  }, 60_000)

  afterAll(async () => {
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('sin token da 401 y con token de vendedor da 403', async () => {
    expect((await listCategoriesRoute(req(), undefined)).status).toBe(401)
    expect((await listCategoriesRoute(req(vendedor.token), undefined)).status).toBe(403)
  })

  it('el admin lista las categorías existentes', async () => {
    const res = await listCategoriesRoute(req(admin.token), undefined)
    expect(res.status).toBe(200)
    const list = (await res.json()) as { id: number; name: string; slug: string }[]
    expect(Array.isArray(list)).toBe(true)
  })
})
