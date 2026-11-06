import { getSellerHolding, updateSellerHolding } from '@deliveries'
import { requireRole } from '@auth'
import { validation } from '@lib/errors'
import { handle, parseId, parseUuid, readJson, requireMoney } from '@lib/handler'

type Ctx = { params: Promise<{ id: string; productId: string }> }

// Lo que el vendedor ya tiene de un producto (piezas y precios propios), para prellenar «Dejar».
export const GET = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  const { id, productId } = await params
  return Response.json(await getSellerHolding(parseUuid(id), parseId(productId)))
})

// Precio o costo del vendedor: obligatorio en el cuerpo, pero null significa «usar el general».
function optionalMoney(body: Record<string, unknown>, field: string, opts: Parameters<typeof requireMoney>[2]) {
  return body[field] === null ? null : requireMoney(body, field, opts)
}

// Corrige lo ya dejado al vendedor: total de piezas (qty, 0 o más), precio y costo con envío.
export const PATCH = handle<Ctx>(async (request, { params }) => {
  const admin = await requireRole(request, 'admin')
  const { id, productId } = await params
  const body = await readJson(request)
  const qty = body['qty']
  if (typeof qty !== 'number' || !Number.isInteger(qty)) throw validation('El campo qty debe ser un número entero')
  const holding = await updateSellerHolding({
    sellerId: parseUuid(id),
    productId: parseId(productId),
    qty,
    unitPrice: optionalMoney(body, 'unitPrice', { scale: 2, label: 'El precio' }),
    unitCostWithShipping: optionalMoney(body, 'unitCostWithShipping', { scale: 4, label: 'El costo' }),
  }, admin.userId)
  return Response.json(holding)
})
