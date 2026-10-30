import { logout, requireAuth } from '@auth'
import { handle } from '@lib/handler'

export const POST = handle(async (request) => {
  await requireAuth(request)
  const token = request.headers.get('authorization')!.replace(/^Bearer\s+/i, '')
  await logout(token)
  return new Response(null, { status: 204 })
})
