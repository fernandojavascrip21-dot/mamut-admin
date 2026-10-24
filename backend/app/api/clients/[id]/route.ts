import { deleteClient, getClient, updateClient } from '../../../../src/accounts/clients'
import { requireRole } from '../../../../src/auth/guards'
import { validation } from '../../../../src/lib/errors'
import { handle, optionalText, parseId, readJson } from '../../../../src/lib/handler'

type Ctx = { params: Promise<{ id: string }> }

export const GET = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  return Response.json(await getClient(parseId((await params).id)))
})

export const PATCH = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  const id = parseId((await params).id)
  const body = await readJson(request)
  const name = optionalText(body, 'name')
  if (name === null) throw validation('El nombre no puede quedar vacío')
  const client = await updateClient(id, {
    name,
    contactName: optionalText(body, 'contactName'),
    phone: optionalText(body, 'phone'),
    address: optionalText(body, 'address'),
    notes: optionalText(body, 'notes'),
  })
  return Response.json(client)
})

export const DELETE = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  await deleteClient(parseId((await params).id))
  return new Response(null, { status: 204 })
})
