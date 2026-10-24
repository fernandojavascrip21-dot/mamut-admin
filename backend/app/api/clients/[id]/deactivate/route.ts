import { deactivateClient } from '../../../../../src/accounts/clients'
import { requireRole } from '../../../../../src/auth/guards'
import { handle, parseId } from '../../../../../src/lib/handler'

type Ctx = { params: Promise<{ id: string }> }

export const POST = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  return Response.json(await deactivateClient(parseId((await params).id)))
})
