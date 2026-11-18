import type { SellerStatusVariables } from './constants'

export type SellerStatusKind = 'deactivated' | 'reactivated'

// Esqueleto (spec M13-hu44): asunto y variables de la plantilla, con el nombre ya escapado.
export function sellerStatusEmail(_kind: SellerStatusKind, _name: string): { subject: string; variables: SellerStatusVariables } {
  throw new Error('Pendiente: sellerStatusEmail')
}
