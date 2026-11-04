import { requireRole } from '@auth'
import { getSaleCatalog } from '@inventory'
import { validation } from '@lib/errors'
import { handle } from '@lib/handler'
import { UUID } from '@lib/constants'

// Catálogo para vender como administrador (HU-17): lo que se puede vender de un titular, con piezas,
// precio y costo ya resueltos. Sin `holderId` (o vacío) es la bodega; con un UUID, un vendedor activo.
// Un valor que no es UUID da 422; un vendedor inexistente o inactivo, 404. Solo el administrador.
export const GET = handle(async (request) => {
  await requireRole(request, 'admin')
  const raw = new URL(request.url).searchParams.get('holderId')
  if (raw && !UUID.test(raw)) throw validation('El campo holderId debe ser un UUID')
  return Response.json(await getSaleCatalog(raw ? raw.toLowerCase() : null))
})
