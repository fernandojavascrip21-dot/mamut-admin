import { createDelivery, listSellerDeliveries } from '@deliveries'
import { requireRole } from '@auth'
import { validation } from '@lib/errors'
import { handle, parseUuid, readJson, requireMoney, requireNumber } from '@lib/handler'

type Ctx = { params: Promise<{ id: string }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Precio o costo del vendedor: el campo es obligatorio en el cuerpo, pero null significa «usar el
// general». Un texto vacío o ausente es 422, no «general», para no borrar un precio por descuido.
function optionalMoney(body: Record<string, unknown>, field: string, opts: Parameters<typeof requireMoney>[2]) {
  return body[field] === null ? null : requireMoney(body, field, opts)
}

// Dejarle producto a un vendedor (HU-11): 201 la primera vez, 200 si es una repetición del mismo requestId.
export const POST = handle<Ctx>(async (request, { params }) => {
  const admin = await requireRole(request, 'admin')
  const sellerId = parseUuid((await params).id)
  const body = await readJson(request)

  const requestId = body['requestId']
  if (typeof requestId !== 'string' || !UUID.test(requestId)) throw validation('El campo requestId debe ser un UUID')

  const { delivery, replayed } = await createDelivery({
    requestId: requestId.toLowerCase(),
    sellerId,
    productId: requireNumber(body, 'productId', { integer: true }),
    qty: requireNumber(body, 'qty', { integer: true }),
    unitPrice: optionalMoney(body, 'unitPrice', { scale: 2, label: 'El precio' }),
    unitCostWithShipping: optionalMoney(body, 'unitCostWithShipping', { scale: 4, label: 'El costo' }),
  }, admin.userId)
  return Response.json(delivery, { status: replayed ? 200 : 201 })
})

// «Últimas entregas» del detalle de un vendedor.
export const GET = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  return Response.json(await listSellerDeliveries(parseUuid((await params).id)))
})
