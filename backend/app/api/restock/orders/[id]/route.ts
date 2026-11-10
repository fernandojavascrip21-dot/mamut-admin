import { requireRole } from '@auth'
import { deleteRestockOrder, getRestockOrder, updateRestockOrder } from '@restock'
import { handle, optionalText, parseRouteId, readJson, requireLines } from '@lib/handler'

type Ctx = { params: Promise<{ id: string }> }

// Detalle de un pedido con sus renglones. Solo administrador.
export const GET = handle<Ctx>(async (request, { params }) => {
  const actor = await requireRole(request, 'admin')
  const id = parseRouteId((await params).id)
  return Response.json({ order: await getRestockOrder(id, actor) })
})

// Reemplaza la nota y los renglones de un borrador. Un pedido cerrado responde 409 en el caso de uso.
export const PUT = handle<Ctx>(async (request, { params }) => {
  const actor = await requireRole(request, 'admin')
  const id = parseRouteId((await params).id)
  const body = await readJson(request)
  const order = await updateRestockOrder(id, {
    note: optionalText(body, 'note') ?? null,
    lines: requireLines(body, 'lines'),
  }, actor)
  return Response.json({ order })
})

// Borra un borrador: 204. Un pedido cerrado responde 409.
export const DELETE = handle<Ctx>(async (request, { params }) => {
  const actor = await requireRole(request, 'admin')
  await deleteRestockOrder(parseRouteId((await params).id), actor)
  return new Response(null, { status: 204 })
})
