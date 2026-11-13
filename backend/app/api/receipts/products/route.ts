import { requireRole } from '@auth'
import { handle } from '@lib/handler'
import { listReceiptProducts } from '@receipts'

// Productos que el administrador puede elegir al corregir una remisión (HU-42). Solo lectura.
export const GET = handle(async (request) => {
  const actor = await requireRole(request, 'admin')
  return Response.json(await listReceiptProducts(actor))
})
