import { createSeller } from '@accounts'
import { requireRole } from '@auth'
import { handle, readJson, requireString } from '@lib/handler'

// Solo un administrador da de alta vendedores (HU-08); un vendedor recibe 403.
export const POST = handle(async (request) => {
  await requireRole(request, 'admin')
  const body = await readJson(request)
  const seller = await createSeller({
    email: requireString(body, 'email'),
    password: requireString(body, 'password'),
    fullName: requireString(body, 'fullName').trim(),
    phone: requireString(body, 'phone'),
  })
  return Response.json(seller, { status: 201 })
})
