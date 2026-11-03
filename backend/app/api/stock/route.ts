import { requireRole } from '@auth'
import { getStockOverview } from '@inventory'
import { handle } from '@lib/handler'

// «Stock general» (HU-13): bodega, cada vendedor y el reparto por producto, solo para administradores.
export const GET = handle(async (request) => {
  await requireRole(request, 'admin')
  return Response.json(await getStockOverview())
})
