import { requireRole } from '@auth'
import { handle } from '@lib/handler'
import { listShrinkageOptions } from '@shrinkage'

// Opciones del pop-up «Registrar merma» (HU-25). Sin `sellerId` (o vacío) son los productos de la
// bodega; con un UUID, las piezas de ese vendedor. Un valor que no es UUID da 422; un vendedor
// inexistente o inactivo, 404. Solo el administrador (403 si es vendedor, 401 sin sesión).
export const GET = handle(async (request) => {
  const actor = await requireRole(request, 'admin')
  // Vacío = bodega. La validación del UUID y su normalización viven en el caso de uso.
  const raw = new URL(request.url).searchParams.get('sellerId')
  return Response.json(await listShrinkageOptions(raw || null, actor))
})
