import { eq, like } from 'drizzle-orm'
import { db } from '../../src/db/client'
import { clients, debtors, profiles } from '../../src/db/schema'
import { supabaseAdmin, supabaseAuth } from '../../src/lib/supabase'

// Todo lo que crean las pruebas lleva este prefijo para poder limpiarlo.
export const TEST_PREFIX = 'test-auth-'
export const TEST_PASSWORD = 'Prueba-123456!'
export const TEST_SELLER_PHONE = '5500000000'

export const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

export interface TestUser {
  id: string
  email: string
  token: string
  refreshToken: string
}

export async function createTestUser(
  label: string,
  profile: { role: 'admin' | 'client' | 'vendedor'; clientId?: number; active?: boolean } | null,
): Promise<TestUser> {
  const email = `${TEST_PREFIX}${label}-${Date.now()}@example.com`
  const { data, error } = await supabaseAdmin().auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`No se creó el usuario de prueba: ${error?.message}`)

  // La base exige teléfono de 10 dígitos a los vendedores (spec T-10).
  if (profile) {
    await db.insert(profiles).values({
      id: data.user.id,
      role: profile.role,
      clientId: profile.clientId ?? null,
      fullName: `Prueba ${label}`,
      phone: profile.role === 'vendedor' ? TEST_SELLER_PHONE : null,
      active: profile.active ?? true,
    })
  }

  const login = await supabaseAuth().auth.signInWithPassword({ email, password: TEST_PASSWORD })
  if (login.error || !login.data.session) throw new Error('No se obtuvo token de prueba')
  return {
    id: data.user.id,
    email,
    token: login.data.session.access_token,
    refreshToken: login.data.session.refresh_token,
  }
}

export async function createTestClient(label: string) {
  const [row] = await db
    .insert(clients)
    .values({ name: `${TEST_PREFIX}${label}-${Date.now()}` })
    .returning()
  return row!
}

// Borra perfiles, cuentas de Auth y clientes creados por las pruebas.
export async function cleanupTestData() {
  const admin = supabaseAdmin()
  await db.delete(debtors).where(like(debtors.name, `${TEST_PREFIX}%`))
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  for (const user of data?.users ?? []) {
    if (!user.email?.startsWith(TEST_PREFIX)) continue
    await db.delete(profiles).where(eq(profiles.id, user.id))
    await admin.auth.admin.deleteUser(user.id)
  }
  await db.delete(clients).where(like(clients.name, `${TEST_PREFIX}%`))
}
