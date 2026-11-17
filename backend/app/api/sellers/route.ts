import { createSeller, listSellers, parseListStatus } from '@accounts'
import { requireRole } from '@auth'
import { handle, readJson, requireString } from '@lib/handler'

// Solo un administrador da de alta vendedores (HU-08); un vendedor recibe 403. El negocio es opcional
// (T-42): la validación de su largo está en createSeller.
export const POST = handle(async (request) => {
  await requireRole(request, 'admin')
  const body = await readJson(request)
  const seller = await createSeller({
    email: requireString(body, 'email'),
    password: requireString(body, 'password'),
    fullName: requireString(body, 'fullName').trim(),
    phone: requireString(body, 'phone'),
    businessName: body.businessName,
  })
  return Response.json(seller, { status: 201 })
})

// «Mis vendedores» (HU-09): vendedores según `?status=` (activos por omisión), solo para administradores.
export const GET = handle(async (request) => {
  await requireRole(request, 'admin')
  const status = parseListStatus(new URL(request.url).searchParams.get('status'))
  return Response.json(await listSellers(status))
})
