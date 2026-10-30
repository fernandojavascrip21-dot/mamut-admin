import { createClient, listClients } from '../../../src/accounts'
import { requireRole } from '../../../src/auth'
import { handle, optionalText, readJson, requireString } from '../../../src/lib/handler'

export const GET = handle(async (request) => {
  await requireRole(request, 'admin')
  return Response.json(await listClients())
})

export const POST = handle(async (request) => {
  await requireRole(request, 'admin')
  const body = await readJson(request)
  const client = await createClient({
    name: requireString(body, 'name').trim(),
    contactName: optionalText(body, 'contactName'),
    phone: optionalText(body, 'phone'),
    address: optionalText(body, 'address'),
    notes: optionalText(body, 'notes'),
  })
  return Response.json(client, { status: 201 })
})
