import { requireRole } from '@auth'
import { validation } from '@lib/errors'
import { handle } from '@lib/handler'
import { UUID } from '@lib/constants'
import { getPurchase } from '@purchases'

type Ctx = { params: Promise<{ requestId: string }> }

// Releer una entrada por su requestId si se perdió la respuesta (HU-27). Un requestId que no es UUID
// da 422; uno que no es de una entrada, 404.
export const GET = handle<Ctx>(async (request, { params }) => {
  const actor = await requireRole(request, 'admin')
  const { requestId } = await params
  if (!UUID.test(requestId)) throw validation('El requestId debe ser un UUID')
  return Response.json({ purchase: await getPurchase(requestId.toLowerCase(), actor) })
})
