import { createReturn, listSellerReturns } from '@returns'
import { requireRole } from '@auth'
import { validation } from '@lib/errors'
import { handle, parseUuid, readJson, requireNumber } from '@lib/handler'

type Ctx = { params: Promise<{ id: string }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Retirarle piezas a un vendedor (HU-12): 201 la primera vez, 200 si es una repetición del mismo requestId.
export const POST = handle<Ctx>(async (request, { params }) => {
  const admin = await requireRole(request, 'admin')
  const sellerId = parseUuid((await params).id)
  const body = await readJson(request)

  const requestId = body['requestId']
  if (typeof requestId !== 'string' || !UUID.test(requestId)) throw validation('El campo requestId debe ser un UUID')

  const { sellerReturn, replayed } = await createReturn({
    requestId: requestId.toLowerCase(),
    sellerId,
    productId: requireNumber(body, 'productId', { integer: true }),
    qty: requireNumber(body, 'qty', { integer: true }),
  }, admin.userId)
  return Response.json(sellerReturn, { status: replayed ? 200 : 201 })
})

// «Últimos retiros» del detalle de un vendedor.
export const GET = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  return Response.json(await listSellerReturns(parseUuid((await params).id)))
})
