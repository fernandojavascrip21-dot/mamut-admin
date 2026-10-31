import { getDelivery } from '@deliveries'
import { requireRole } from '@auth'
import { handle, parseUuid } from '@lib/handler'

type Ctx = { params: Promise<{ requestId: string }> }

// Resumen de una entrega por su requestId; un id que no es UUID no existe: 404.
export const GET = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  return Response.json(await getDelivery(parseUuid((await params).requestId)))
})
