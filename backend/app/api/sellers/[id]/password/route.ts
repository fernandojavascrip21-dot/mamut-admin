import { setSellerPassword } from '@accounts'
import { requireRole } from '@auth'
import { handle, parseUuid, readJson, requireString } from '@lib/handler'

type Ctx = { params: Promise<{ id: string }> }

// Contraseña temporal del vendedor (spec M13-t42): cierra sus sesiones. La contraseña nunca se
// devuelve ni se registra; la respuesta es 204 sin cuerpo.
export const PUT = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  const id = parseUuid((await params).id)
  const body = await readJson(request)
  await setSellerPassword(id, requireString(body, 'password'))
  return new Response(null, { status: 204 })
})
