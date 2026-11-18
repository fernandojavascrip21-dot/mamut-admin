// API pública del módulo de avisos por correo (spec M13-hu44): solo lo que usan los demás módulos.
import { sendEmail } from './resend'
import { sellerStatusEmail, type SellerStatusKind } from './seller-status-email'

export type EmailStatus = 'sent' | 'failed' | 'skipped'

// Manda el aviso de desactivado / reactivado al correo del vendedor; nunca lanza. Sin correo del
// vendedor no hay a quién escribir ('skipped'). El id de la plantilla es de la cuenta de Resend: viene del entorno.
export async function sendSellerStatusEmail(input: {
  to: string | null
  name: string
  kind: SellerStatusKind
}): Promise<EmailStatus> {
  if (!input.to) return 'skipped'
  const { subject, variables } = sellerStatusEmail(input.kind, input.name)
  return sendEmail({
    to: input.to,
    subject,
    templateId: process.env.RESEND_TEMPLATE_SELLER_STATUS ?? '',
    variables: { ...variables },
  })
}
