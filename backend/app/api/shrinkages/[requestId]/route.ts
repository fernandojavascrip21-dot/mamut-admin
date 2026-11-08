import { requireRole } from '@auth'
import { validation } from '@lib/errors'
import { handle } from '@lib/handler'
import { UUID } from '@lib/constants'
import { getShrinkage } from '@shrinkage'

type Ctx = { params: Promise<{ requestId: string }> }

// Releer una merma por su requestId si se perdió la respuesta (T-25). Un requestId que no es UUID
// da 422; uno que no es de una merma, 404.
export const GET = handle<Ctx>(async (request, { params }) => {
  const actor = await requireRole(request, 'admin')
  const { requestId } = await params
  if (!UUID.test(requestId)) throw validation('El requestId debe ser un UUID')
  return Response.json({ shrinkage: await getShrinkage(requestId.toLowerCase(), actor) })
})
