import { requireRole } from '@auth'
import { getSale } from '@sales'
import { validation } from '@lib/errors'
import { handle } from '@lib/handler'
import { UUID } from '@lib/constants'

type Ctx = { params: Promise<{ requestId: string }> }

// Resumen de una venta por su requestId (T-18). Un requestId que no es UUID da 422; uno que no
// existe, o una venta de otro stock pedida por un vendedor, da 404.
export const GET = handle<Ctx>(async (request, { params }) => {
  const actor = await requireRole(request, 'admin', 'vendedor')
  const requestId = (await params).requestId
  if (!UUID.test(requestId)) throw validation('El requestId debe ser un UUID')
  return Response.json({ sale: await getSale(requestId.toLowerCase(), actor) })
})
