import { requireRole } from '@auth'
import { closeRestockOrder } from '@restock'
import { handle, parseRouteId } from '@lib/handler'

type Ctx = { params: Promise<{ id: string }> }

// Cierra un borrador con renglones: pasa a closed con closedAt. Solo administrador.
export const POST = handle<Ctx>(async (request, { params }) => {
  const actor = await requireRole(request, 'admin')
  const id = parseRouteId((await params).id)
  return Response.json({ order: await closeRestockOrder(id, actor) })
})
