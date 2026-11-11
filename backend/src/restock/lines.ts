import { validation } from '@lib/errors'
import { requireNumber } from '@lib/handler'
import { INVALID_LINE_KIND } from './constants'
import type { RestockLineInput } from './types'

// Lista de renglones del cuerpo. Cada uno es de catálogo (`productId`) o escrito a mano (`name`), con
// `qty` entero y `unitCost` opcional (texto o número). Solo valida la forma: los rangos, los
// repetidos y las reglas de producto viven en el caso de uso, que también recibe los datos directos.
export function requireLines(body: Record<string, unknown>, field: string): RestockLineInput[] {
  const value: unknown = body[field]
  if (!Array.isArray(value)) throw validation(`El campo ${field} debe ser una lista`)
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw validation(`Cada renglón de ${field} debe ser un objeto`)
    }
    const line = item as Record<string, unknown>
    const qty = requireNumber(line, 'qty', { integer: true })
    const unitCost = optionalUnitCost(line)
    const hasProduct = line['productId'] !== undefined
    const hasName = line['name'] !== undefined
    if (hasProduct === hasName) throw validation(INVALID_LINE_KIND)
    if (hasName) {
      if (typeof line['name'] !== 'string') throw validation('El nombre de un producto escrito debe ser texto')
      return { name: line['name'], qty, unitCost: unitCost ?? null }
    }
    return { productId: requireNumber(line, 'productId', { integer: true }), qty, unitCost }
  })
}

// El costo llega como texto o número; el caso de uso lo valida y lo normaliza. Ausente o null = null.
function optionalUnitCost(line: Record<string, unknown>): string | null | undefined {
  const value = line['unitCost']
  if (value === undefined || value === null) return value
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  throw validation('El costo debe ser un monto')
}
