import { requireRole } from '@auth'
import { handle, parseRouteId } from '@lib/handler'
import { rejectLineCost } from '@receipts'

type Ctx = { params: Promise<{ id: string }> }

// Rechaza el costo nuevo de un renglón (HU-42): el costo del producto no cambia. Solo administrador.
export const POST = handle<Ctx>(async (request, { params }) => {
  const actor = await requireRole(request, 'admin')
  return Response.json(await rejectLineCost(parseRouteId((await params).id), actor))
})
