import { refresh } from '../../../../src/auth'
import { handle, readJson, requireString } from '../../../../src/lib/handler'

export const POST = handle(async (request) => {
  const body = await readJson(request)
  return Response.json(await refresh(requireString(body, 'refreshToken')))
})
