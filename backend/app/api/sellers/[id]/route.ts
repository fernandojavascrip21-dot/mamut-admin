import { deleteSeller, getSeller, parseDetailIncludesInactive, updateSeller } from '@accounts'
import { requireRole } from '@auth'
import { handle, parseUuid, readJson, requireString } from '@lib/handler'

type Ctx = { params: Promise<{ id: string }> }

// Detalle de un vendedor (HU-09) con su stock por producto, solo para administradores. `?status=any`
// lo abre también si está desactivado (T-42).
export const GET = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  const { id } = await params
  const includeInactive = parseDetailIncludesInactive(new URL(request.url).searchParams.get('status'))
  return Response.json(await getSeller(parseUuid(id), { includeInactive }))
})

// Editar a un vendedor (spec M13-t42): el cuerpo lleva siempre los cuatro datos del formulario.
// Funciona también con vendedores desactivados, para corregir datos antes de reactivarlos.
export const PUT = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  const id = parseUuid((await params).id)
  const body = await readJson(request)
  const seller = await updateSeller(id, {
    fullName: requireString(body, 'fullName'),
    businessName: body['businessName'],
    phone: requireString(body, 'phone'),
    email: requireString(body, 'email'),
  })
  return Response.json(seller)
})

// Eliminar un alta hecha por error (spec M13-t42): 204 si no tenía historial; 409 si lo tiene.
export const DELETE = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  await deleteSeller(parseUuid((await params).id))
  return new Response(null, { status: 204 })
})
