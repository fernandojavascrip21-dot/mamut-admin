import { requireRole } from '@auth'
import { handle } from '@lib/handler'

// Esqueleto de HU-23: solo administradores; la lista de opciones aún no se implementa.
export const GET = handle(async (request) => {
  await requireRole(request, 'admin')
  return Response.json({ products: [] })
})
