import { requireAuth } from '@auth'
import { handle } from '@lib/handler'

export const GET = handle(async (request) => Response.json(await requireAuth(request)))
