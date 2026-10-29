import { notFound, toResponse, validation } from './errors'
import { compareMoney, decimalPlaces, fromMinorUnits, MONEY_MAX, toMinorUnits, type MoneyScale } from './money'

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

// Campo numérico obligatorio. `min` es exclusivo (el valor debe ser > min, default 0);
// `integer: true` además rechaza decimales. Cualquier caso inválido responde 422, nunca 500.
export function requireNumber(
  body: Record<string, unknown>,
  field: string,
  opts: { min?: number; integer?: boolean } = {},
): number {
  const { min = 0, integer = false } = opts
  const value = body[field]
  if (typeof value !== 'number' || Number.isNaN(value)) throw validation(`Falta el campo ${field}`)
  if (integer && !Number.isInteger(value)) throw validation(`El campo ${field} debe ser un número entero`)
  if (value <= min) throw validation(`El campo ${field} debe ser mayor a ${min}`)
  return value
}

// Monto obligatorio (spec T-08): acepta "450.5" o 450.5, valida formato, decimales según `scale`,
// > 0 y el máximo de su columna, y devuelve el texto normalizado ("450.50") listo para numeric.
// Nunca redondea: un número JSON con artefactos de flotante (0.30000000000000004) da 422.
export function requireMoney(
  body: Record<string, unknown>,
  field: string,
  opts: { scale: MoneyScale; label: string },
): string {
  const { scale, label } = opts
  const raw = body[field]
  if (raw === undefined || raw === null || raw === '') throw validation(`Falta el campo ${field}`)
  if (typeof raw !== 'string' && (typeof raw !== 'number' || !Number.isFinite(raw))) {
    throw validation(`${label} no es un monto válido`)
  }
  const text = typeof raw === 'number' ? String(raw) : raw.trim()
  const decimals = decimalPlaces(text)
  if (decimals === null) throw validation(`${label} no es un monto válido`)
  if (decimals > scale) throw validation(`${label} admite hasta ${scale} decimales`)

  const [integerPart = ''] = text.split('.')
  const maxIntegerDigits = MONEY_MAX[scale].split('.')[0]!.length
  if (integerPart.replace(/^0+(?=\d)/, '').length > maxIntegerDigits) {
    throw validation(`${label} es demasiado grande`)
  }
  const units = toMinorUnits(text, scale)
  if (units <= 0) throw validation(`El campo ${field} debe ser mayor a 0`)
  if (compareMoney(text, scale, MONEY_MAX[scale], scale) > 0) throw validation(`${label} es demasiado grande`)
  return fromMinorUnits(units, scale)
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
