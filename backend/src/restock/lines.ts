import { validation } from '@lib/errors'
import { requireNumber } from '@lib/handler'

// Lista de renglones `{ productId, qty }` del cuerpo: cada uno debe ser un objeto con enteros. Solo
// valida la forma; los rangos y las reglas de producto viven en el caso de uso.
export function requireLines(body: Record<string, unknown>, field: string): { productId: number; qty: number }[] {
  const value: unknown = body[field]
  if (!Array.isArray(value)) throw validation(`El campo ${field} debe ser una lista`)
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw validation(`Cada renglón de ${field} debe ser un objeto`)
    }
    const line = item as Record<string, unknown>
    return {
      productId: requireNumber(line, 'productId', { integer: true }),
      qty: requireNumber(line, 'qty', { integer: true }),
    }
  })
}
