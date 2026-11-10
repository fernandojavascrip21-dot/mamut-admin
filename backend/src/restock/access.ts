import { forbidden } from '@lib/errors'
import type { RestockActor } from './types'

// Todo el módulo de resurtir es solo del administrador: un vendedor recibe 403 en cada caso de uso.
export function requireAdmin(actor: RestockActor): void {
  if (actor.role !== 'admin') throw forbidden()
}
