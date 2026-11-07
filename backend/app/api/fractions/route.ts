import { requireRole } from '@auth'
import { createFraction, listFractions } from '@fractions'
import { validation } from '@lib/errors'
import { handle, optionalText, readJson, requireMoney, requireNumber } from '@lib/handler'
import { UUID } from '@lib/constants'

// Fraccionar un entero en bolsitas (T-24): 201 la primera vez, 200 si es una repetición del mismo
// requestId. Solo administrador. `price` es obligatorio solo cuando la bolsita todavía no existe; la
// validación de esa regla vive en el caso de uso. `portionSize` es la porción de la bolsita nueva: si
// la bolsita ya existe, el caso de uso lo ignora.
export const POST = handle(async (request) => {
  const actor = await requireRole(request, 'admin')
  const body = await readJson(request)

  const requestId = body['requestId']
  if (typeof requestId !== 'string' || !UUID.test(requestId)) throw validation('El campo requestId debe ser un UUID')

  const price = body['price'] === undefined || body['price'] === null
    ? null
    : requireMoney(body, 'price', { scale: 2, label: 'El precio' })

  const { fraction, replayed } = await createFraction({
    requestId: requestId.toLowerCase(),
    productId: requireNumber(body, 'productId', { integer: true }),
    portions: requireNumber(body, 'portions', { integer: true }),
    price,
    portionSize: optionalText(body, 'portionSize'),
  }, actor)
  return Response.json({ fraction, replayed }, { status: replayed ? 200 : 201 })
})

// Historial de fraccionados (HU-24): solo administrador; el caso de uso ya limita y ordena.
export const GET = handle(async (request) => {
  await requireRole(request, 'admin')
  return Response.json({ fractions: await listFractions() })
})
