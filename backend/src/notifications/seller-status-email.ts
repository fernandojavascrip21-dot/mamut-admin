import { HTML_ESCAPES, SELLER_STATUS_TEXTS, type SellerStatusVariables } from './constants'

export type SellerStatusKind = 'deactivated' | 'reactivated'

// Resend inserta `{{{NAME}}}` sin escapar, así que el nombre (texto libre) se escapa aquí, una sola vez.
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]!)
}

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
