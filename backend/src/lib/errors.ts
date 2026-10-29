import { ERROR_STATUS } from './constants'

// Formato común de error de la API: { error: { code, message } }.
export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'internal'


export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = ERROR_STATUS[code]
  }
}

export const unauthorized = (message = 'No autenticado') => new AppError('unauthorized', message)
export const forbidden = (message = 'No tienes permiso para esta acción') =>
  new AppError('forbidden', message)
export const notFound = (message = 'No encontrado') => new AppError('not_found', message)
export const conflict = (message: string) => new AppError('conflict', message)
export const validation = (message: string) => new AppError('validation', message)

// Convierte cualquier error en la respuesta HTTP. Los errores no previstos no filtran detalles.
export function toResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json({ error: { code: err.code, message: err.message } }, { status: err.status })
  }
  console.error(err)
  return Response.json(
    { error: { code: 'internal', message: 'Error interno del servidor' } },
    { status: 500 },
  )
}
