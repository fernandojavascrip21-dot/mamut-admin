import { requireRole } from '@auth'
import { handle } from '@lib/handler'
import { listPendingReceiptLines } from '@receipts'

// Pendientes de las remisiones (HU-42): renglones sin producto y cambios de costo. Solo administrador.
export const GET = handle(async (request) => {
  const actor = await requireRole(request, 'admin')
  return Response.json(await listPendingReceiptLines(actor))
})
