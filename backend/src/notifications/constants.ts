export const RESEND_URL = 'https://api.resend.com/emails'
export const EMAIL_TIMEOUT_MS = 5000

// Variables de la plantilla de Resend «Aviso de estado del vendedor» (NAME, HEADLINE, MESSAGE, NOTE).
export interface SellerStatusVariables {
  NAME: string
  HEADLINE: string
  MESSAGE: string
  NOTE: string
}
