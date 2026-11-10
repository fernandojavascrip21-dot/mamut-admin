import { requireRole } from '@auth'
import { validation } from '@lib/errors'
import { handle, readJson, requireNumber } from '@lib/handler'
import { UUID } from '@lib/constants'
import { createPurchase } from '@purchases'

// Entrada a bodega (HU-27): 201 la primera vez, 200 si es una repetición del mismo requestId. Solo
// administrador; las reglas viven en el caso de uso.
export const POST = handle(async (request) => {
  const actor = await requireRole(request, 'admin')
  const body = await readJson(request)

  const requestId = body['requestId']
  if (typeof requestId !== 'string' || !UUID.test(requestId)) throw validation('El campo requestId debe ser un UUID')

  const { purchase, replayed } = await createPurchase({
    requestId: requestId.toLowerCase(),
    productId: requireNumber(body, 'productId', { integer: true }),
    qty: requireNumber(body, 'qty', { integer: true }),
  }, actor)
  return Response.json({ purchase, replayed }, { status: replayed ? 200 : 201 })
})
