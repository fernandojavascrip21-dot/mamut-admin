import { forbidden } from '@lib/errors'
import type { ReceiptActor } from './types'

// Todas las rutas de remisiones son solo del administrador (spec M9-t41 §3): un vendedor recibe 403
// aunque conozca el requestId o el id de un renglón.
export function requireAdmin(actor: ReceiptActor): void {
  if (actor.role !== 'admin') throw forbidden()
}
