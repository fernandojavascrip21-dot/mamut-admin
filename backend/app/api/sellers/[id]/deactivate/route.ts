import { deactivateSeller } from '@accounts'
import { requireRole } from '@auth'
import { handle, parseUuid } from '@lib/handler'

type Ctx = { params: Promise<{ id: string }> }

// Desactivar a un vendedor (spec M13-t42): 409 si aún tiene piezas a su cargo; 200 si ya estaba inactivo.
export const POST = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  return Response.json(await deactivateSeller(parseUuid((await params).id)))
})
