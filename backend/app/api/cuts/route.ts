import { requireRole } from '@auth'
import { DEFAULT_CUT_PERIOD, getCashCut, parseCutPeriod } from '@cuts'
import { validation } from '@lib/errors'
import { handle } from '@lib/handler'
import { UUID } from '@lib/constants'

// Corte de un titular para un día, semana o mes (T-20), calculado cada vez y sin guardarlo.
// `holderId` ausente = la bodega (administrador) o el propio corte (vendedor); `period` ausente = day;
// `date` ausente = hoy en hora de México. La ruta solo valida la forma de los parámetros (UUID y
// periodo); la fecha real y los permisos los resuelve `getCashCut`.
export const GET = handle(async (request) => {
  const actor = await requireRole(request, 'admin', 'vendedor')
  const params = new URL(request.url).searchParams

  const holderId = params.get('holderId')
  if (holderId !== null && !UUID.test(holderId)) throw validation('El parámetro holderId debe ser un UUID')

  const cut = await getCashCut({
    holderId: holderId?.toLowerCase(),
    period: parseCutPeriod(params.get('period') ?? DEFAULT_CUT_PERIOD),
    date: params.get('date') ?? undefined,
  }, actor)
  return Response.json({ cut })
})
