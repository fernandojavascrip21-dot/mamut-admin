import { requireRole } from '@auth'
import { handle } from '@lib/handler'
import { listRestockProducts } from '@restock'

// Productos que se pueden pedir (HU-31): todos los activos que no son bolsita, con piezas de bodega,
// nivel y costo de fábrica. Solo administrador; el vendedor recibe 403.
export const GET = handle(async (request) => {
  const actor = await requireRole(request, 'admin')
  return Response.json(await listRestockProducts(actor))
})
