import { eq } from 'drizzle-orm'
import type { Session } from '@supabase/supabase-js'
import { db } from '@db/client'
import { profiles } from '@db/schema'
import { unauthorized } from '@lib/errors'
import { supabaseAdmin, supabaseAuth } from '@lib/supabase'
import { INVALID_CREDENTIALS } from './constants'
import type { AuthContext } from './context'

export interface SessionResult {
  accessToken: string
  refreshToken: string
  expiresAt: number | null
  user: AuthContext
}

async function loadActiveProfile(userId: string): Promise<AuthContext> {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId))
  if (!profile || !profile.active) throw unauthorized(INVALID_CREDENTIALS)
  return {
    userId: profile.id,
    role: profile.role as AuthContext['role'],
    clientId: profile.clientId,
    fullName: profile.fullName,
  }
}

async function toResult(session: Session): Promise<SessionResult> {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null,
    user: await loadActiveProfile(session.user.id),
  }
}

export async function login(email: string, password: string): Promise<SessionResult> {
  const { data, error } = await supabaseAuth().auth.signInWithPassword({ email, password })
  if (error || !data.session) throw unauthorized(INVALID_CREDENTIALS)
  return toResult(data.session)
}

export async function refresh(refreshToken: string): Promise<SessionResult> {
  const { data, error } = await supabaseAuth().auth.refreshSession({ refresh_token: refreshToken })
  if (error || !data.session) throw unauthorized('Sesión inválida o expirada')
  return toResult(data.session)
}

// Invalida la sesión en Supabase: el token deja de servir aunque no haya expirado.
export async function logout(accessToken: string): Promise<void> {
  await supabaseAdmin().auth.admin.signOut(accessToken)
}
