import { reactivateSeller } from '@accounts'
import { requireRole } from '@auth'
import { handle, parseUuid } from '@lib/handler'

type Ctx = { params: Promise<{ id: string }> }

// Reactivar a un vendedor (spec M13-t42): vuelve a poder entrar con su contraseña. Ya activo = 200.
export const POST = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  return Response.json(await reactivateSeller(parseUuid((await params).id)))
})
