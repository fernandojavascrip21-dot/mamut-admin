import { requireRole } from '@auth'
import { validation } from '@lib/errors'
import { handle, readJson, requireNumber, requireString } from '@lib/handler'
import { UUID } from '@lib/constants'
import { createShrinkage, listShrinkages, SHRINKAGE_HISTORY_LIMIT } from '@shrinkage'

// Merma simple (T-25): 201 la primera vez, 200 si es una repetición del mismo requestId. Solo
// administrador. `holderProfileId` null es la bodega; el resto de las reglas viven en el caso de uso.
export const POST = handle(async (request) => {
  const actor = await requireRole(request, 'admin')
  const body = await readJson(request)

  const requestId = body['requestId']
  if (typeof requestId !== 'string' || !UUID.test(requestId)) throw validation('El campo requestId debe ser un UUID')

  const holder = body['holderProfileId']
  if (holder !== null && (typeof holder !== 'string' || !UUID.test(holder))) {
    throw validation('El campo holderProfileId debe ser null (bodega) o un UUID')
  }

  const { shrinkage, replayed } = await createShrinkage({
    requestId: requestId.toLowerCase(),
    holderProfileId: holder === null ? null : holder.toLowerCase(),
    productId: requireNumber(body, 'productId', { integer: true }),
    qty: requireNumber(body, 'qty', { integer: true }),
    reason: requireString(body, 'reason'),
  }, actor)
  return Response.json({ shrinkage, replayed }, { status: replayed ? 200 : 201 })
})

// Historial de mermas (HU-26): todas, o solo las de `?sellerId=<uuid>` (vacío = todas). Un valor que no
// es UUID da 422; un vendedor que no está activo, 404. Solo el administrador (403 si es vendedor).
export const GET = handle(async (request) => {
  const actor = await requireRole(request, 'admin')
  const raw = new URL(request.url).searchParams.get('sellerId')
  if (!raw) return Response.json(await listShrinkages({ scope: 'all', limit: SHRINKAGE_HISTORY_LIMIT }, actor))
  if (!UUID.test(raw)) throw validation('El campo sellerId debe ser un UUID')
  return Response.json(await listShrinkages({
    scope: 'seller',
    sellerId: raw.toLowerCase(),
    limit: SHRINKAGE_HISTORY_LIMIT,
  }, actor))
})
