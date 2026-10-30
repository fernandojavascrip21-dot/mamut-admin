import { logout, requireAuth } from '../../../../src/auth'
import { handle } from '../../../../src/lib/handler'

export const POST = handle(async (request) => {
  await requireAuth(request)
  const token = request.headers.get('authorization')!.replace(/^Bearer\s+/i, '')
  await logout(token)
  return new Response(null, { status: 204 })
})
