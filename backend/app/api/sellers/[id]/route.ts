import { getSeller, parseDetailIncludesInactive } from '@accounts'
import { requireRole } from '@auth'
import { handle, parseUuid } from '@lib/handler'

type Ctx = { params: Promise<{ id: string }> }

// Detalle de un vendedor (HU-09) con su stock por producto, solo para administradores. `?status=any`
// lo abre también si está desactivado (T-42).
export const GET = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  const { id } = await params
  const includeInactive = parseDetailIncludesInactive(new URL(request.url).searchParams.get('status'))
  return Response.json(await getSeller(parseUuid(id), { includeInactive }))
})

// Esqueletos del spec M13-t42: se implementan después de las pruebas.
export const PUT = async (_request: Request, _context: unknown): Promise<Response> => {
  throw new Error('Sin implementar')
}

export const DELETE = async (_request: Request, _context: unknown): Promise<Response> => {
  throw new Error('Sin implementar')
}
