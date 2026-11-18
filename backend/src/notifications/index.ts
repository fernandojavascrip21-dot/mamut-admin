// API pública del módulo de avisos por correo (spec M13-hu44): solo lo que usan los demás módulos.
import type { SellerStatusKind } from './seller-status-email'

export type EmailStatus = 'sent' | 'failed' | 'skipped'

// Esqueleto: manda el aviso de desactivado / reactivado al correo del vendedor; nunca lanza.
export async function sendSellerStatusEmail(_input: {
  to: string | null
  name: string
  kind: SellerStatusKind
}): Promise<EmailStatus> {
  throw new Error('Pendiente: sendSellerStatusEmail')
}
