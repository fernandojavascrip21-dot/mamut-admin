import { requireRole } from '@auth'
import { validation } from '@lib/errors'
import { handle } from '@lib/handler'
import { UUID } from '@lib/constants'
import { listShrinkageOptions } from '@shrinkage'

// Opciones del pop-up «Registrar merma» (HU-25). Sin `sellerId` (o vacío) son los productos de la
// bodega; con un UUID, las piezas de ese vendedor. Un valor que no es UUID da 422; un vendedor
// inexistente o inactivo, 404. Solo el administrador (403 si es vendedor, 401 sin sesión).
export const GET = handle(async (request) => {
  const actor = await requireRole(request, 'admin')
  const raw = new URL(request.url).searchParams.get('sellerId')
  if (raw && !UUID.test(raw)) throw validation('El campo sellerId debe ser un UUID')
  return Response.json(await listShrinkageOptions(raw ? raw.toLowerCase() : null, actor))
})
