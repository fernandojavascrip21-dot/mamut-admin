import { FinishReason, GoogleGenAI } from '@google/genai'
import type { GenerateContentResponse } from '@google/genai'
import { AppError } from '@lib/errors'
import {
  AI_NOT_CONFIGURED,
  AI_READ_FAILED,
  AI_TIMEOUT_MS,
  RECEIPT_AI_INSTRUCTIONS,
  RECEIPT_AI_MODEL,
  RECEIPT_AI_REQUEST_TEXT,
  RECEIPT_LINES_SCHEMA,
} from '../constants'
import type { ImageReader, PdfReader, RawReceiptLine } from '../types'

// Lectores de PDF e imagen con la API de Gemini (spec M9-t41 §3). Comparten la llamada, el esquema y
// las instrucciones: solo cambia el archivo que va como inlineData.
export const readPdf: PdfReader = (bytes) =>
  readWithGemini({ mimeType: 'application/pdf', data: toBase64(bytes) })

export const readImage: ImageReader = (bytes, mediaType) =>
  readWithGemini({ mimeType: mediaType, data: toBase64(bytes) })

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

// Llama a la API con salida JSON con esquema. La clave se lee en cada llamada: sin ella no hay lectura
// y la respuesta es el mismo 500 de «no configurada», sin intentar nada.
async function readWithGemini(file: { mimeType: string; data: string }): Promise<RawReceiptLine[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new AppError('internal', AI_NOT_CONFIGURED)

  // Un solo intento (attempts: 1) y tiempo de espera de 60 s: un reintento automático podría pasar
  // del límite de la lectura y gastar la cuota diaria de la capa gratuita.
  const ai = new GoogleGenAI({ apiKey })
  let response: GenerateContentResponse
  try {
    response = await ai.models.generateContent({
      model: RECEIPT_AI_MODEL,
      contents: [{ role: 'user', parts: [{ inlineData: file }, { text: RECEIPT_AI_REQUEST_TEXT }] }],
      config: {
        systemInstruction: RECEIPT_AI_INSTRUCTIONS,
        responseMimeType: 'application/json',
        responseJsonSchema: RECEIPT_LINES_SCHEMA,
        httpOptions: { timeout: AI_TIMEOUT_MS, retryOptions: { attempts: 1 } },
      },
    })
  } catch {
    // Cualquier falla (HTTP, 429 de la capa gratuita, conexión o tiempo agotado) es una lectura fallida.
    throw new AppError('internal', AI_READ_FAILED)
  }

  // Un prompt bloqueado o una respuesta cortada, que no termina en STOP, no trae una remisión utilizable.
  const finishReason = response.candidates?.[0]?.finishReason
  if (response.promptFeedback?.blockReason || finishReason !== FinishReason.STOP) {
    throw new AppError('internal', AI_READ_FAILED)
  }
  return parseLines(response.text)
}

// Valida el texto JSON. La salida del modelo no se confía: la forma se revisa con unknown; piezas y
// costo pasan tal cual y la vista previa los valida como a un Excel.
function parseLines(text: string | undefined): RawReceiptLine[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text ?? '')
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
