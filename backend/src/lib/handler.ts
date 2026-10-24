import { notFound, toResponse, validation } from './errors'

type Handler<C> = (request: Request, context: C) => Promise<Response>

// Envuelve un route handler: cualquier error se convierte en la respuesta común { error }.
export function handle<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await fn(request, context)
    } catch (err) {
      return toResponse(err)
    }
  }
}

// Lee el cuerpo JSON; si no es un objeto responde 422.
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validation('El cuerpo debe ser un objeto JSON')
  }
  return body as Record<string, unknown>
}

export function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field]
  if (typeof value !== 'string' || value.trim() === '') throw validation(`Falta el campo ${field}`)
  return value
}

// Parámetro de ruta numérico (`/api/clients/:id`). Si no es un entero positivo, no existe: 404.
export function parseId(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) throw notFound()
  return Number(value)
}

// Campo de texto opcional: ausente = no cambia; null o vacío = se borra; texto = se recorta.
export function optionalText(body: Record<string, unknown>, field: string): string | null | undefined {
  const value = body[field]
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') throw validation(`El campo ${field} debe ser texto`)
  return value.trim() === '' ? null : value.trim()
}

// Parámetro de ruta uuid (`/api/logins/:id`). Si no tiene forma de uuid, no existe: 404.
export function parseUuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw notFound()
  return value.toLowerCase()
}
