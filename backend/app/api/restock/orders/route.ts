import { requireRole } from '@auth'
import { createRestockOrder, listRestockOrders, requireLines } from '@restock'
import { validation } from '@lib/errors'
import { handle, optionalText, readJson } from '@lib/handler'
import { UUID } from '@lib/constants'

// Lista de pedidos (los 50 más recientes). `?status=` acepta draft o closed; otro valor, 422 en el
// caso de uso. Solo administrador.
export const GET = handle(async (request) => {
  const actor = await requireRole(request, 'admin')
  const status = new URL(request.url).searchParams.get('status') ?? undefined
  return Response.json(await listRestockOrders({ status }, actor))
})

// Alta de un pedido: 201 la primera vez, 200 si es una repetición del mismo requestId (HU-27).
export const POST = handle(async (request) => {
  const actor = await requireRole(request, 'admin')
  const body = await readJson(request)

  const requestId = body['requestId']
  if (typeof requestId !== 'string' || !UUID.test(requestId)) throw validation('El campo requestId debe ser un UUID')

  const { order, replayed } = await createRestockOrder({
    requestId: requestId.toLowerCase(),
    note: optionalText(body, 'note') ?? null,
    lines: requireLines(body, 'lines'),
  }, actor)
  return Response.json({ order, replayed }, { status: replayed ? 200 : 201 })
})
