import { setLoginPassword } from '@accounts'
import { requireRole } from '@auth'
import { handle, parseUuid, readJson, requireString } from '@lib/handler'

type Ctx = { params: Promise<{ id: string }> }

export const POST = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  const id = parseUuid((await params).id)
  const body = await readJson(request)
  await setLoginPassword(id, requireString(body, 'password'))
  return new Response(null, { status: 204 })
})
