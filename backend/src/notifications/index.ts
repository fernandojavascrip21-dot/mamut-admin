// API pública del módulo de avisos por correo (spec M13-hu44): solo lo que usan los demás módulos.
import { sendEmail } from './resend'
import { sellerDeletedEmail } from './seller-deleted-email'
import type { SellerDeletedKind } from './constants'
import { sellerPasswordEmail } from './seller-password-email'
import { sellerStatusEmail, type SellerStatusKind } from './seller-status-email'

export type EmailStatus = 'sent' | 'failed' | 'skipped'

export { sellerPasswordEmail }

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
    logLabel: 'el aviso de estado',
  })
}

// Avisa al vendedor que su contraseña fue cambiada (spec M13-hu45); nunca lanza y nunca recibe la contraseña.
// Sin correo no hay a quién escribir ('skipped'). El id de la plantilla viene del entorno.
export async function sendSellerPasswordEmail(input: { to: string | null; name: string }): Promise<EmailStatus> {
  if (!input.to) return 'skipped'
  const { subject, variables } = sellerPasswordEmail(input.name)
  return sendEmail({
    to: input.to,
    subject,
    templateId: process.env.RESEND_TEMPLATE_SELLER_PASSWORD ?? '',
    variables: { ...variables },
    logLabel: 'el aviso del vendedor',
  })
}

// Avisa al vendedor que su cuenta fue eliminada (spec M13-t44); nunca lanza. Sin correo no hay a quién
// escribir ('skipped'). El id de la plantilla viene del entorno.
export async function sendSellerDeletedEmail(input: {
  to: string | null
  name: string
  kind: SellerDeletedKind
}): Promise<EmailStatus> {
  if (!input.to) return 'skipped'
  const { subject, variables } = sellerDeletedEmail(input.kind, input.name)
  return sendEmail({
    to: input.to,
    subject,
    templateId: process.env.RESEND_TEMPLATE_SELLER_DELETE ?? '',
    variables: { ...variables },
    logLabel: 'el aviso de eliminación',
  })
}
