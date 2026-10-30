import { deactivateAdmin } from '@accounts'
import { requireRole } from '@auth'
import { handle, parseUuid } from '@lib/handler'

type Ctx = { params: Promise<{ id: string }> }

export const POST = handle<Ctx>(async (request, { params }) => {
  const actor = await requireRole(request, 'admin')
  return Response.json(await deactivateAdmin(actor.userId, parseUuid((await params).id)))
})
