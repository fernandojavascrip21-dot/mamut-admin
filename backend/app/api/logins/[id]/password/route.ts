import { setLoginPassword } from '../../../../../src/accounts/logins'
import { requireRole } from '../../../../../src/auth/guards'
import { handle, parseUuid, readJson, requireString } from '../../../../../src/lib/handler'

type Ctx = { params: Promise<{ id: string }> }

export const POST = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  const id = parseUuid((await params).id)
  const body = await readJson(request)
  await setLoginPassword(id, requireString(body, 'password'))
  return new Response(null, { status: 204 })
})
