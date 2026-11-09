import type { ShrinkageActor, ShrinkageHistoryFilter, ShrinkageHistoryItem } from './types'

// Historial de mermas (HU-26). Esqueleto: aún sin implementar.
export async function listShrinkages(
  filter: ShrinkageHistoryFilter,
  actor: ShrinkageActor,
): Promise<ShrinkageHistoryItem[]> {
  throw new Error(`no implementado: ${filter.scope} ${actor.role}`)
}
