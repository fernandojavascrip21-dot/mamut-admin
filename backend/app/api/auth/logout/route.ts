import { requireAuth } from '../../../../src/auth/guards'
import { logout } from '../../../../src/auth/session'
import { handle } from '../../../../src/lib/handler'

export const POST = handle(async (request) => {
  await requireAuth(request)
  const token = request.headers.get('authorization')!.replace(/^Bearer\s+/i, '')
  await logout(token)
  return new Response(null, { status: 204 })
})
