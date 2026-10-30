import { deleteLogin, updateLogin } from '@accounts'
import { requireRole } from '@auth'
import { handle, parseUuid, readJson, requireString } from '@lib/handler'

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  const id = parseUuid((await params).id)
  const body = await readJson(request)
  return Response.json(await updateLogin(id, { fullName: requireString(body, 'fullName').trim() }))
})

export const DELETE = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  await deleteLogin(parseUuid((await params).id))
  return new Response(null, { status: 204 })
})
