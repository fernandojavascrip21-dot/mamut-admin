import { requireRole } from '@auth'
import { handle, parseRouteId } from '@lib/handler'
import { acceptLineCost } from '@receipts'

type Ctx = { params: Promise<{ id: string }> }

// Acepta el costo nuevo de un renglón (HU-42): cambia el costo del producto. Solo administrador.
export const POST = handle<Ctx>(async (request, { params }) => {
  const actor = await requireRole(request, 'admin')
  return Response.json(await acceptLineCost(parseRouteId((await params).id), actor))
})
