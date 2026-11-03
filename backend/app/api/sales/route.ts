import { requireRole } from '@auth'
import { createSale } from '@sales'
import { validation } from '@lib/errors'
import { handle, readJson, requireNumber } from '@lib/handler'
import { UUID } from '@lib/constants'

// Registrar una venta (T-18): 201 la primera vez, 200 si es una repetición del mismo requestId.
// `holderId` solo lo usa el administrador: ausente o null = bodega, o el id de un vendedor activo.
export const POST = handle(async (request) => {
  const actor = await requireRole(request, 'admin', 'vendedor')
  const body = await readJson(request)

  const requestId = body['requestId']
  if (typeof requestId !== 'string' || !UUID.test(requestId)) throw validation('El campo requestId debe ser un UUID')

  const holderField = body['holderId']
  if (holderField !== undefined && holderField !== null && (typeof holderField !== 'string' || !UUID.test(holderField))) {
    throw validation('El campo holderId debe ser un UUID')
  }

  const rawLines = body['lines']
  if (!Array.isArray(rawLines)) throw validation('Falta el campo lines')
  const lines = rawLines.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw validation('Cada renglón debe ser un objeto')
    const line = raw as Record<string, unknown>
    return {
      productId: requireNumber(line, 'productId', { integer: true }),
      qty: requireNumber(line, 'qty', { integer: true }),
    }
  })

  const { sale, replayed } = await createSale({
    requestId: requestId.toLowerCase(),
    holderId: typeof holderField === 'string' ? holderField.toLowerCase() : holderField,
    lines,
  }, actor)
  return Response.json({ sale, replayed }, { status: replayed ? 200 : 201 })
})
