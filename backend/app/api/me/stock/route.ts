import { requireRole } from '@auth'
import { getOwnStock } from '@inventory'
import { handle } from '@lib/handler'

// «Mi stock» (HU-14): lo que tiene el vendedor en mano, con su precio y sin costos. El id sale de la
// sesión, nunca de la URL ni del cuerpo.
export const GET = handle(async (request) => {
  const ctx = await requireRole(request, 'vendedor')
  return Response.json(await getOwnStock(ctx.userId))
})
