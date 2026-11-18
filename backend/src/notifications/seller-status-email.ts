import { SELLER_STATUS_TEXTS, type SellerStatusVariables } from './constants'
import { escapeHtml } from './escape-html'

export type SellerStatusKind = 'deactivated' | 'reactivated'

// Asunto y variables de la plantilla; el asunto es el mismo título para no depender de la plantilla.
export function sellerStatusEmail(
  kind: SellerStatusKind,
  name: string,
): { subject: string; variables: SellerStatusVariables } {
  const text = SELLER_STATUS_TEXTS[kind]
  return {
    subject: text.headline,
    variables: { NAME: escapeHtml(name), HEADLINE: text.headline, MESSAGE: text.message, NOTE: text.note },
  }
}
