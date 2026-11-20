import { SELLER_PASSWORD_TEXTS, type SellerPasswordVariables } from './constants'
import { escapeHtml } from './escape-html'

// Asunto y variables de la plantilla «Contraseña cambiada»; el asunto es el título para no depender de la plantilla.
export function sellerPasswordEmail(name: string): { subject: string; variables: SellerPasswordVariables } {
  const text = SELLER_PASSWORD_TEXTS
  return {
    subject: text.headline,
    variables: { NAME: escapeHtml(name), HEADLINE: text.headline, MESSAGE: text.message, NOTE: text.note },
  }
}
