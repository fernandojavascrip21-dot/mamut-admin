import { db } from '../db/client'
import { profiles } from '../db/schema'
import { conflict, validation } from '../lib/errors'
import { supabaseAdmin } from '../lib/supabase'

const MIN_PASSWORD = 8
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Profile = typeof profiles.$inferSelect

// Vista pública de una cuenta con login (cliente o administrador).
export interface AccountView {
  id: string
  clientId: number | null
  fullName: string
  email: string | null
  active: boolean
  createdAt: string
}

export async function toView(profile: Profile): Promise<AccountView> {
  const { data } = await supabaseAdmin().auth.admin.getUserById(profile.id)
  return {
    id: profile.id,
    clientId: profile.clientId,
    fullName: profile.fullName,
    email: data.user?.email ?? null,
    active: profile.active,
    createdAt: profile.createdAt,
  }
}

export function validatePassword(password: string): void {
  if (password.length < MIN_PASSWORD) {
    throw validation(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`)
  }
}

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  if (!EMAIL_PATTERN.test(normalized)) throw validation('El correo no es válido')
  return normalized
}

// Crea la cuenta en Supabase Auth y su fila en `profiles`. No hay transacción común entre los
// dos sistemas: si falla el insert se borra la cuenta recién creada (sin cuentas huérfanas).
export async function createAccount(
  input: { email: string; password: string; fullName: string },
  profile: { role: 'admin' | 'client'; clientId: number | null; active: boolean },
): Promise<AccountView> {
  const email = normalizeEmail(input.email)
  validatePassword(input.password)

  const admin = supabaseAdmin()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  })
  if (error || !data.user) {
    if (error?.code === 'email_exists' || /already.*regist/i.test(error?.message ?? '')) {
      throw conflict('Ya existe un acceso con ese correo')
    }
    throw error ?? new Error('No se pudo crear la cuenta')
  }

  try {
    const [created] = await db
      .insert(profiles)
      .values({ id: data.user.id, fullName: input.fullName, ...profile })
      .returning()
    return toView(created!)
  } catch (err) {
    await admin.auth.admin.deleteUser(data.user.id)
    throw err
  }
}
