import { refresh } from '@auth'
import { handle, readJson, requireString } from '@lib/handler'

export const POST = handle(async (request) => {
  const body = await readJson(request)
  return Response.json(await refresh(requireString(body, 'refreshToken')))
})
