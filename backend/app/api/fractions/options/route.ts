import { requireRole } from '@auth'
import { listFractionOptions } from '@fractions'
import { handle } from '@lib/handler'

// Opciones para fraccionar (HU-23): enteros activos que se fraccionan, con su bolsita si existe. Solo
// administrador; un vendedor recibe 403 y sin sesión 401.
export const GET = handle(async (request) => {
  await requireRole(request, 'admin')
  return Response.json({ products: await listFractionOptions() })
})
