import { listCategories } from '../../../src/categories'
import { requireRole } from '../../../src/auth'
import { handle } from '../../../src/lib/handler'

export const GET = handle(async (request) => {
  await requireRole(request, 'admin')
  return Response.json(await listCategories())
})
