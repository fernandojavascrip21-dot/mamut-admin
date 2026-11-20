import { EMAIL_TIMEOUT_MS, RESEND_URL } from './constants'
import type { EmailStatus } from './index'

export interface SendEmailInput {
  to: string
  subject: string
  templateId: string
  variables: Record<string, string>
  // Cómo se llama el aviso en el log; nunca lleva datos del correo.
  logLabel: string
}

// Envía un correo con una plantilla publicada de Resend. Nunca lanza: el aviso no puede romper el
// cambio de estado que ya se confirmó. Sin las variables de entorno no hay envío ('skipped'). El log
// lleva solo el motivo, nunca el correo ni el cuerpo.
export async function sendEmail(input: SendEmailInput): Promise<EmailStatus> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (!apiKey || !from || !input.templateId) return 'skipped'
  try {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        template: { id: input.templateId, variables: input.variables },
      }),
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    })
    if (response.ok) return 'sent'
    console.error(`Resend rechazó ${input.logLabel} (HTTP ${response.status})`)
    return 'failed'
  } catch (err) {
    console.error(`No se pudo enviar ${input.logLabel} (${err instanceof Error ? err.name : 'error'})`)
    return 'failed'
  }
}
