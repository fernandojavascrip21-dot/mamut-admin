import { requireRole } from '@auth'
import { getFraction } from '@fractions'
import { validation } from '@lib/errors'
import { handle } from '@lib/handler'
import { UUID } from '@lib/constants'

type Ctx = { params: Promise<{ requestId: string }> }

// Resumen de un fraccionado por su requestId (T-24). Solo administrador. Un requestId que no es UUID
// da 422; uno que no existe, 404.
export const GET = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  const requestId = (await params).requestId
  if (!UUID.test(requestId)) throw validation('El requestId debe ser un UUID')
  return Response.json({ fraction: await getFraction(requestId.toLowerCase()) })
})
