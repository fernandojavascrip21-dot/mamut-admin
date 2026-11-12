import { requireRole } from '@auth'
import { handle, parseRouteId } from '@lib/handler'
import { discardLine } from '@receipts'

type Ctx = { params: Promise<{ id: string }> }

// Descarta un producto nuevo (HU-42): sus piezas nunca entran a bodega. Solo administrador.
export const POST = handle<Ctx>(async (request, { params }) => {
  const actor = await requireRole(request, 'admin')
  return Response.json(await discardLine(parseRouteId((await params).id), actor))
})
