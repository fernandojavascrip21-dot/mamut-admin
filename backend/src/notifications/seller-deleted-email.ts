import { SELLER_DELETED_TEXTS, type SellerDeletedKind, type SellerDeletedVariables } from './constants'
import { escapeHtml } from './escape-html'

// Asunto y variables de la plantilla de eliminación; el asunto es el mismo título para no depender de la plantilla.
export function sellerDeletedEmail(
  kind: SellerDeletedKind,
  name: string,
): { subject: string; variables: SellerDeletedVariables } {
  const { headline, message, notes } = SELLER_DELETED_TEXTS
  return {
    subject: headline,
    variables: { NAME: escapeHtml(name), HEADLINE: headline, MESSAGE: message, NOTE: notes[kind] },
  }
}
