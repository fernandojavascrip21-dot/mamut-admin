import { AppError } from '@lib/errors'
import { AI_NOT_CONFIGURED } from '../constants'
import type { ImageReader, PdfReader } from '../types'

// Lectores de PDF e imagen con la API de Claude (spec M9-t41 §3). Aún no están conectados: el paso 7
// los reemplaza. Mientras tanto responden el mismo 500 que sin ANTHROPIC_API_KEY.
export const readPdf: PdfReader = async () => {
  throw new AppError('internal', AI_NOT_CONFIGURED)
}

export const readImage: ImageReader = async () => {
  throw new AppError('internal', AI_NOT_CONFIGURED)
}
