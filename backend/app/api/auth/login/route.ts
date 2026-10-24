import { login } from '../../../../src/auth/session'
import { handle, readJson, requireString } from '../../../../src/lib/handler'

export const POST = handle(async (request) => {
  const body = await readJson(request)
  const result = await login(requireString(body, 'email'), requireString(body, 'password'))
  return Response.json(result)
})
