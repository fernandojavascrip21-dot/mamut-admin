import { requireRole } from '@auth'
import { handle } from '@lib/handler'
import { getRestockSuggestions } from '@restock'

// Sugerencias de resurtir (T-36): productos con poca existencia en bodega. Solo administrador.
export const GET = handle(async (request) => {
  const actor = await requireRole(request, 'admin')
  return Response.json(await getRestockSuggestions(actor))
})
