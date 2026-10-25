import { listCategories } from '../../../src/categories/categories'
import { requireRole } from '../../../src/auth/guards'
import { handle } from '../../../src/lib/handler'

export const GET = handle(async (request) => {
  await requireRole(request, 'admin')
  return Response.json(await listCategories())
})
