import { getReturn } from '@returns'
import { requireRole } from '@auth'
import { handle, parseUuid } from '@lib/handler'

type Ctx = { params: Promise<{ id: string; requestId: string }> }

// Resumen de un retiro por su requestId; un id que no es UUID no existe: 404.
export const GET = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  const { id, requestId } = await params
  return Response.json(await getReturn(parseUuid(id), parseUuid(requestId)))
})
