import { forbidden } from '@lib/errors'
import { getAuthContext, type AuthContext } from './context'

// Exige sesión válida (perfil existente y activo).
export function requireAuth(request: Request): Promise<AuthContext> {
  return getAuthContext(request)
}

export function assertRole(ctx: AuthContext, roles: AuthContext['role'][]): void {
  if (!roles.includes(ctx.role)) throw forbidden()
}

// Exige sesión válida y uno de los roles indicados.
export async function requireRole(
  request: Request,
  ...roles: AuthContext['role'][]
): Promise<AuthContext> {
  const ctx = await getAuthContext(request)
  assertRole(ctx, roles)
  return ctx
}

// Pertenencia: el admin accede a cualquier cliente; un cliente solo al suyo.
export function requireOwnClient(ctx: AuthContext, clientId: number): void {
  if (ctx.role === 'admin') return
  if (ctx.clientId !== clientId) throw forbidden()
}
