import { getSeller } from '@accounts'
import { requireRole } from '@auth'
import { handle, parseUuid } from '@lib/handler'

type Ctx = { params: Promise<{ id: string }> }

// Detalle de un vendedor (HU-09) con su stock por producto, solo para administradores.
export const GET = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  const { id } = await params
  return Response.json(await getSeller(parseUuid(id)))
})
