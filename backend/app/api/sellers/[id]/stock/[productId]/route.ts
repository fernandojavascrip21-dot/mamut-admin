import { getSellerHolding } from '@deliveries'
import { requireRole } from '@auth'
import { handle, parseId, parseUuid } from '@lib/handler'

type Ctx = { params: Promise<{ id: string; productId: string }> }

// Lo que el vendedor ya tiene de un producto (piezas y precios propios), para prellenar «Dejar».
export const GET = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  const { id, productId } = await params
  return Response.json(await getSellerHolding(parseUuid(id), parseId(productId)))
})
