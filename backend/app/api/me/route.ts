import { requireAuth } from '../../../src/auth/guards'
import { handle } from '../../../src/lib/handler'

export const GET = handle(async (request) => Response.json(await requireAuth(request)))
