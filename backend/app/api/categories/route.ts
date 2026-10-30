import { listCategories } from '@categories'
import { requireRole } from '@auth'
import { handle } from '@lib/handler'

export const GET = handle(async (request) => {
  await requireRole(request, 'admin')
  return Response.json(await listCategories())
})
