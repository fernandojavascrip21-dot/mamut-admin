import { requireRole } from '@auth'
import { getOwnStock } from '@inventory'
import { handle } from '@lib/handler'

// «Mi stock» (HU-14): lo que tiene el vendedor en mano, con su precio y sin costos. El id sale de la
// sesión, nunca de la URL ni del cuerpo. `?includeSoldOut=true` (catálogo «Vender», HU-15) agrega lo
// que tuvo y se le acabó; cualquier otro valor, o sin parámetro, responde como en HU-14.
export const GET = handle(async (request) => {
  const ctx = await requireRole(request, 'vendedor')
  const includeSoldOut = new URL(request.url).searchParams.get('includeSoldOut') === 'true'
  return Response.json(await getOwnStock(ctx.userId, { includeSoldOut }))
})
