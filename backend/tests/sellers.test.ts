import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POST as loginRoute } from '@api/auth/login/route'
import { POST as createSellerRoute } from '@api/sellers/route'
import { normalizePhone } from '@accounts'
import { db, sql } from '@db/client'
import { profiles } from '@db/schema'
import { supabaseAdmin } from '@lib/supabase'
import {
  cleanupTestData,
  createTestUser,
  hasServiceKey,
  TEST_PASSWORD,
  TEST_PREFIX,
  type TestUser,
} from './helpers/users'

const req = (method: string, token?: string, body?: unknown) =>
  new Request('http://api.test/api/sellers', {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const email = (label: string) => `${TEST_PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`

// Mismos casos que src/app/sellers/rules/seller.rules.spec.ts (contrato compartido).
describe('normalizePhone (regla pura)', () => {
  it.each(['55 2468 1357', '55-2468-1357', '(55) 2468 1357', '5524681357'])('«%s» queda como 5524681357', (raw) => {
    expect(normalizePhone(raw)).toBe('5524681357')
  })

  it.each(['+525524681357', '552468135', '55246813570', '55 2468 135a', ''])('«%s» da 422', (raw) => {
    expect(() => normalizePhone(raw)).toThrowError(expect.objectContaining({ status: 422, message: 'El teléfono debe tener 10 dígitos' }))
  })
})

describe.skipIf(!hasServiceKey)('alta de vendedores (HU-08, con cuentas reales)', () => {
  let admin: TestUser
  let seller: TestUser

  const body = (label: string, extra: Record<string, unknown> = {}) => ({
    fullName: `Vendedor ${label}`,
    phone: '55 2468 1357',
    email: email(label),
    password: TEST_PASSWORD,
    ...extra,
  })

  beforeAll(async () => {
    await cleanupTestData()
    admin = await createTestUser('sellers-admin', { role: 'admin' })
    seller = await createTestUser('sellers-vendedor', { role: 'vendedor' })
  }, 60_000)

  afterAll(async () => {
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('crea al vendedor activo con el teléfono solo en dígitos, y puede iniciar sesión', async () => {
    const input = body('ok', { fullName: '  Luis Vendedor  ' })
    const res = await createSellerRoute(req('POST', admin.token, input), undefined)
    expect(res.status).toBe(201)
    const created = await res.json()
    expect(created).toMatchObject({ fullName: 'Luis Vendedor', email: input.email, phone: '5524681357', active: true, clientId: null })

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, created.id))
    expect(profile).toMatchObject({ role: 'vendedor', phone: '5524681357', active: true })

    const login = await loginRoute(req('POST', undefined, { email: input.email, password: TEST_PASSWORD }), undefined)
    expect(login.status).toBe(200)
    expect((await login.json()).user).toMatchObject({ userId: created.id, role: 'vendedor' })
  })

  it.each(['55-2468-1357', '(55) 2468 1357'])('acepta el teléfono «%s»', async (phone) => {
    const res = await createSellerRoute(req('POST', admin.token, body('phone', { phone })), undefined)
    expect(res.status).toBe(201)
    expect((await res.json()).phone).toBe('5524681357')
  })

  it('un teléfono inválido da 422 y no crea la cuenta en Auth', async () => {
    const input = body('bad-phone', { phone: '+525524681357' })
    const res = await createSellerRoute(req('POST', admin.token, input), undefined)
    expect(res.status).toBe(422)
    expect((await res.json()).error.message).toBe('El teléfono debe tener 10 dígitos')

    const { data } = await supabaseAdmin().auth.admin.listUsers({ perPage: 200 })
    expect(data.users.some((u) => u.email === input.email)).toBe(false)
  })

  it('un correo ya usado da 409 y no deja nada creado', async () => {
    const input = body('dup')
    expect((await createSellerRoute(req('POST', admin.token, input), undefined)).status).toBe(201)
    const before = await db.select({ id: profiles.id }).from(profiles)

    const res = await createSellerRoute(req('POST', admin.token, { ...input, fullName: 'Otro' }), undefined)
    expect(res.status).toBe(409)
    expect((await res.json()).error.message).toBe('Ya existe un acceso con ese correo')
    expect((await db.select({ id: profiles.id }).from(profiles)).length).toBe(before.length)
  })

  it('valida contraseña, correo y campos faltantes con 422', async () => {
    for (const extra of [{ password: 'corta' }, { email: 'sin-arroba' }, { fullName: '   ' }, { phone: undefined }]) {
      const res = await createSellerRoute(req('POST', admin.token, body('invalid', extra)), undefined)
      expect(res.status, JSON.stringify(extra)).toBe(422)
    }
  })

  it('un vendedor recibe 403 y sin sesión es 401', async () => {
    expect((await createSellerRoute(req('POST', seller.token, body('forbidden')), undefined)).status).toBe(403)
    expect((await createSellerRoute(req('POST', undefined, body('anon')), undefined)).status).toBe(401)
  })
})
