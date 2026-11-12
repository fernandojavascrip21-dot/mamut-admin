import Anthropic from '@anthropic-ai/sdk'
import { AppError } from '@lib/errors'
import {
  AI_NOT_CONFIGURED,
  AI_READ_FAILED,
  AI_TIMEOUT_MS,
  RECEIPT_AI_INSTRUCTIONS,
  RECEIPT_AI_MAX_TOKENS,
  RECEIPT_AI_MODEL,
  RECEIPT_AI_REQUEST_TEXT,
  RECEIPT_LINES_SCHEMA,
} from '../constants'
import type { ImageReader, PdfReader, RawReceiptLine } from '../types'

// Lectores de PDF e imagen con la API de Claude (spec M9-t41 §3). Comparten la llamada, el esquema y
// las instrucciones: solo cambia el bloque de contenido (documento o imagen).
export const readPdf: PdfReader = (bytes) =>
  readWithClaude({
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: toBase64(bytes) },
  })

export const readImage: ImageReader = (bytes, mediaType) =>
  readWithClaude({
    type: 'image',
    source: { type: 'base64', media_type: mediaType, data: toBase64(bytes) },
  })

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

// Llama a la API con salida estructurada. La clave se lee en cada llamada: sin ella no hay lectura
// y la respuesta es el mismo 500 de «no configurada», sin intentar nada.
async function readWithClaude(block: Anthropic.Messages.ContentBlockParam): Promise<RawReceiptLine[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new AppError('internal', AI_NOT_CONFIGURED)

  // Un solo reintento: el tiempo de espera total de la lectura ya es de 60 s.
  const client = new Anthropic({ apiKey, timeout: AI_TIMEOUT_MS, maxRetries: 1 })
  let response: Anthropic.Messages.Message
  try {
    response = await client.messages.create({
      model: RECEIPT_AI_MODEL,
      max_tokens: RECEIPT_AI_MAX_TOKENS,
      system: RECEIPT_AI_INSTRUCTIONS,
      messages: [{ role: 'user', content: [block, { type: 'text', text: RECEIPT_AI_REQUEST_TEXT }] }],
      output_config: { format: { type: 'json_schema', schema: RECEIPT_LINES_SCHEMA } },
    })
  } catch (error) {
    // Cualquier falla del SDK (HTTP, conexión o tiempo agotado) se muestra como lectura fallida.
    if (error instanceof Anthropic.AnthropicError) throw new AppError('internal', AI_READ_FAILED)
    throw error
  }

  // Una respuesta cortada por tokens o rechazada por el modelo no trae una remisión utilizable.
  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
    throw new AppError('internal', AI_READ_FAILED)
  }
  return parseLines(response.content)
}

// Une los bloques de texto y los valida. La salida del modelo no se confía: la forma se revisa con
// unknown; piezas y costo pasan tal cual y la vista previa los valida como a un Excel.
function parseLines(content: Anthropic.Messages.ContentBlock[]): RawReceiptLine[] {
  const text = content
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('')
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new AppError('internal', AI_READ_FAILED)
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.lines)) throw new AppError('internal', AI_READ_FAILED)
  return parsed.lines.map((line: unknown, index) => {
    if (!isRecord(line)) throw new AppError('internal', AI_READ_FAILED)
    return {
      position: index + 1,
      name: typeof line.name === 'string' ? line.name : null,
      qty: line.qty,
      unitCost: line.unitCost,
    }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
