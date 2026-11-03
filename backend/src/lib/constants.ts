import type { ErrorCode } from './errors'
import type { MoneyScale } from './money'

// Status HTTP fijo de cada código de error de la API.
export const ERROR_STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  validation: 422,
  internal: 500,
}

// Máximo de cada columna: numeric(10,2) para precios y numeric(10,4) para costos (spec T-08).
export const MONEY_MAX: Record<MoneyScale, string> = { 2: '99999999.99', 4: '999999.9999' }

// Texto decimal sin signo, comas ni notación científica: «450», «450.50».
export const DECIMAL = /^(\d+)(?:\.(\d+))?$/

// UUID en texto (requestId, holderId): 8-4-4-4-12 dígitos hexadecimales.
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
