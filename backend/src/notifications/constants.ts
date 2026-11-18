export const RESEND_URL = 'https://api.resend.com/emails'
export const EMAIL_TIMEOUT_MS = 5000

// Variables de la plantilla de Resend «Aviso de estado del vendedor» (NAME, HEADLINE, MESSAGE, NOTE).
export interface SellerStatusVariables {
  NAME: string
  HEADLINE: string
  MESSAGE: string
  NOTE: string
}

// Texto de cada aviso (tabla de §3 del spec): título (también es el asunto), frase principal y recuadro.
export const SELLER_STATUS_TEXTS = {
  deactivated: {
    headline: 'Tu acceso a Mammut fue desactivado',
    message: 'Tu usuario en Mammut fue desactivado y ya no podrás entrar a la app.',
    note: 'Tu historial de ventas se conserva.',
  },
  reactivated: {
    headline: 'Tu acceso a Mammut fue reactivado',
    message: 'Tu usuario en Mammut fue reactivado. Ya puedes entrar a la app.',
    note: 'Entra con tu correo y tu contraseña de siempre.',
  },
} as const

// Caracteres que la plantilla (triple llave, sin escape propio) no neutraliza.
export const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
