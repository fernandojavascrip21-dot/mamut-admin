import { requireRole } from '@auth'
import {
  BUSINESS_REQUIRES_HOME, BUSINESS_WITHOUT_HOLDER, DEFAULT_CUT_PERIOD, DEFAULT_CUT_SCOPE, DEFAULT_CUT_TYPE,
  getBusinessCut, getCashCut, getHomeCut, parseCutPeriod, parseCutScope, parseCutType,
} from '@cuts'
import { validation } from '@lib/errors'
import { handle } from '@lib/handler'
import { UUID } from '@lib/constants'

// Corte de un titular para un día, semana o mes (T-20), calculado cada vez y sin guardarlo.
// `type` ausente = prices (corte con precios); `home` = corte para casa (T-22). `scope=business`
// (HU-22, solo con `type=home` y sin `holderId`) = resumen de todo el negocio; ausente = `holder`.
// `holderId` ausente = la bodega (administrador) o el propio corte (vendedor); `period` ausente = day;
// `date` ausente = hoy en hora de México. La ruta solo valida la forma de los parámetros (UUID,
// periodo, tipo y alcance); la fecha real y los permisos los resuelven `getCashCut`, `getHomeCut` y `getBusinessCut`.
export const GET = handle(async (request) => {
  const actor = await requireRole(request, 'admin', 'vendedor')
  const params = new URL(request.url).searchParams

  const holderId = params.get('holderId')
  if (holderId !== null && !UUID.test(holderId)) throw validation('El parámetro holderId debe ser un UUID')
  const type = parseCutType(params.get('type') ?? DEFAULT_CUT_TYPE)

  const scope = parseCutScope(params.get('scope') ?? DEFAULT_CUT_SCOPE)
  if (scope === 'business' && type !== 'home') throw validation(BUSINESS_REQUIRES_HOME)
  if (scope === 'business' && holderId !== null) throw validation(BUSINESS_WITHOUT_HOLDER)

  const input = {
    holderId: holderId?.toLowerCase(),
    period: parseCutPeriod(params.get('period') ?? DEFAULT_CUT_PERIOD),
    date: params.get('date') ?? undefined,
  }
  if (scope === 'business') return Response.json({ cut: await getBusinessCut(input, actor) })
  const cut = type === 'home' ? await getHomeCut(input, actor) : await getCashCut(input, actor)
  return Response.json({ cut })
})
