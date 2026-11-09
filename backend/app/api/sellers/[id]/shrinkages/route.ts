import { listShrinkages, SELLER_SHRINKAGE_HISTORY_LIMIT } from '@shrinkage'
import { requireRole } from '@auth'
import { handle, parseUuid } from '@lib/handler'

type Ctx = { params: Promise<{ id: string }> }

// «Últimas mermas» del detalle de un vendedor (HU-26): solo el administrador. Un id que no es UUID da
// 422 (parseUuid) y un vendedor que no está activo, 404 (lo resuelve listShrinkages).
export const GET = handle<Ctx>(async (request, { params }) => {
  const actor = await requireRole(request, 'admin')
  const sellerId = parseUuid((await params).id)
  return Response.json(await listShrinkages({ scope: 'seller', sellerId, limit: SELLER_SHRINKAGE_HISTORY_LIMIT }, actor))
})
