import type { EmailStatus } from './index'

export interface SendEmailInput {
  to: string
  subject: string
  templateId: string
  variables: Record<string, string>
}

// Esqueleto (spec M13-hu44): el envío real a Resend se implementa en el paso 1 del plan.
export async function sendEmail(_input: SendEmailInput): Promise<EmailStatus> {
  throw new Error('Pendiente: sendEmail')
}
