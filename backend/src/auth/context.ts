import { eq } from 'drizzle-orm'
import { db } from '@db/client'
import { profiles } from '@db/schema'
import { unauthorized } from '@lib/errors'
import { supabaseAuth } from '@lib/supabase'

export interface AuthContext {
  userId: string // profiles.id (= auth.users.id)
  role: 'admin' | 'client' | 'vendedor'
  clientId: number | null // null si role = 'admin'
  fullName: string
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  const match = header?.match(/^Bearer\s+(\S+)$/i)
  return match?.[1] ?? null
}

// Valida el JWT con Supabase Auth y carga el perfil en cada petición (no se confía en claims
// del token): así desactivar o borrar un acceso surte efecto de inmediato.
// Todos los fallos responden el mismo 401 genérico.
export async function getAuthContext(request: Request): Promise<AuthContext> {
  const token = bearerToken(request)
  if (!token) throw unauthorized()

  const { data, error } = await supabaseAuth().auth.getUser(token)
  if (error || !data.user) throw unauthorized()

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, data.user.id))
  if (!profile || !profile.active) throw unauthorized()

  return {
    userId: profile.id,
    role: profile.role as AuthContext['role'],
    clientId: profile.clientId,
    fullName: profile.fullName,
  }
}
