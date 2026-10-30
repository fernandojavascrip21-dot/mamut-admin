import { login } from '@auth'
import { handle, readJson, requireString } from '@lib/handler'

export const POST = handle(async (request) => {
  const body = await readJson(request)
  const result = await login(requireString(body, 'email'), requireString(body, 'password'))
  return Response.json(result)
})
