import { setLoginActive } from '../../../../../src/accounts/logins'
import { requireRole } from '../../../../../src/auth/guards'
import { handle, parseUuid } from '../../../../../src/lib/handler'

type Ctx = { params: Promise<{ id: string }> }

export const POST = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  return Response.json(await setLoginActive(parseUuid((await params).id), true))
})
