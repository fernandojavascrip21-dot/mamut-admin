import { createAdmin, listAdmins } from '@accounts'
import { requireRole } from '@auth'
import { handle, readJson, requireString } from '@lib/handler'

// Solo un administrador crea a otro; un cliente recibe 403.
export const GET = handle(async (request) => {
  await requireRole(request, 'admin')
  return Response.json(await listAdmins())
})

export const POST = handle(async (request) => {
  await requireRole(request, 'admin')
  const body = await readJson(request)
  const admin = await createAdmin({
    email: requireString(body, 'email'),
    password: requireString(body, 'password'),
    fullName: requireString(body, 'fullName').trim(),
  })
  return Response.json(admin, { status: 201 })
})
