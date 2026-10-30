import { reactivateAdmin } from '../../../../../src/accounts'
import { requireRole } from '../../../../../src/auth'
import { handle, parseUuid } from '../../../../../src/lib/handler'

type Ctx = { params: Promise<{ id: string }> }

export const POST = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  return Response.json(await reactivateAdmin(parseUuid((await params).id)))
})
