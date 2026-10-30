import { createLogin, listLogins } from '@accounts'
import { requireRole } from '@auth'
import { validation } from '@lib/errors'
import { handle, parseId, readJson, requireString } from '@lib/handler'

type Ctx = { params: Promise<{ id: string }> }

export const GET = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  return Response.json(await listLogins(parseId((await params).id)))
})

export const POST = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  const clientId = parseId((await params).id)
  const body = await readJson(request)
  // Este endpoint solo crea clientes; los administradores se crean en /api/admins.
  if (body.role !== undefined && body.role !== 'client') {
    throw validation('Los administradores se crean en /api/admins')
  }
  const login = await createLogin(clientId, {
    email: requireString(body, 'email'),
    password: requireString(body, 'password'),
    fullName: requireString(body, 'fullName').trim(),
  })
  return Response.json(login, { status: 201 })
})
