import { requireRole } from '@auth'
import { handle } from '@lib/handler'
import { UUID } from '@lib/constants'
import { getReceipt, RECEIPT_NOT_FOUND } from '@receipts'
import { notFound } from '@lib/errors'

type Ctx = { params: Promise<{ requestId: string }> }

// Releer una remisión por su requestId, p. ej. si se perdió la respuesta de la confirmación (HU-42).
// Un requestId que no es UUID no puede existir: 404, igual que uno que no es de una remisión.
export const GET = handle<Ctx>(async (request, { params }) => {
  const actor = await requireRole(request, 'admin')
  const { requestId } = await params
  if (!UUID.test(requestId)) throw notFound(RECEIPT_NOT_FOUND)
  return Response.json({ receipt: await getReceipt(requestId.toLowerCase(), actor) })
})
