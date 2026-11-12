import { requireRole } from '@auth'
import { validation } from '@lib/errors'
import { handle } from '@lib/handler'
import { UUID } from '@lib/constants'
import { getReceipt, INVALID_REQUEST_ID } from '@receipts'

type Ctx = { params: Promise<{ requestId: string }> }

// Releer una remisión por su requestId, p. ej. si se perdió la respuesta de la confirmación (HU-42).
// Un requestId que no es UUID da 422; uno que no es de una remisión, 404.
export const GET = handle<Ctx>(async (request, { params }) => {
  const actor = await requireRole(request, 'admin')
  const { requestId } = await params
  if (!UUID.test(requestId)) throw validation(INVALID_REQUEST_ID)
  return Response.json({ receipt: await getReceipt(requestId.toLowerCase(), actor) })
})
