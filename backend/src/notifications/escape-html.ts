import { HTML_ESCAPES } from './constants'

// Resend inserta `{{{NAME}}}` sin escapar, así que el nombre (texto libre) se escapa aquí, una sola vez.
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]!)
}
