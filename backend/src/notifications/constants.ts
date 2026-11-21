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

export type SellerDeletedKind = 'archived' | 'purged'
// Las mismas cuatro variables de la plantilla: NAME, HEADLINE, MESSAGE y NOTE.
export type SellerDeletedVariables = SellerStatusVariables

// Texto del aviso de eliminación (§3 del spec M13-t44): la nota cambia según se archivó o se borró.
export const SELLER_DELETED_TEXTS = {
  headline: 'Tu cuenta de Mammut fue eliminada',
  message: 'Tu usuario en Mammut fue eliminado y ya no podrás entrar a la app.',
  notes: {
    archived: 'Tu historial de ventas se conserva.',
    purged: 'Ya no hay datos tuyos en la app.',
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

// Variables de la plantilla «Contraseña cambiada» (spec M13-hu45): las mismas cuatro del aviso de estado.
export type SellerPasswordVariables = SellerStatusVariables

// Texto del aviso de contraseña temporal (§3 del spec): el título es también el asunto. Nunca lleva la contraseña.
export const SELLER_PASSWORD_TEXTS = {
  headline: 'Tu contraseña de Mammut fue cambiada',
  message: 'Tu administrador te asignó una contraseña temporal. Pídesela a tu administrador para entrar a la app.',
  note: 'Por seguridad, no incluimos tu contraseña en este correo.',
} as const
