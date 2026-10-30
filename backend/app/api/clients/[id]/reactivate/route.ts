import { reactivateClient } from '@accounts'
import { requireRole } from '@auth'
import { handle, parseId } from '@lib/handler'

type Ctx = { params: Promise<{ id: string }> }

export const POST = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  return Response.json(await reactivateClient(parseId((await params).id)))
})
