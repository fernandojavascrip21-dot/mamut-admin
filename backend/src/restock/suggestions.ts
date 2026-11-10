import { restockCandidates, stockLevelOf } from '@stock'
import { requireAdmin } from './access'
import type { RestockActor, RestockSuggestion } from './types'

// Sugerencias de resurtir (T-36): solo lectura, no depende de ningún pedido. Las piezas de los
// vendedores no cuentan, por eso el filtro de la bodega vive en `restockCandidates`.
// Orden igual que lowStockLines: agotados primero, luego por nombre.
export async function getRestockSuggestions(actor: RestockActor): Promise<{ suggestions: RestockSuggestion[] }> {
  requireAdmin(actor)
  const candidates = await restockCandidates()
  const suggestions = candidates.flatMap((row): RestockSuggestion[] => {
    // El candidato ya viene filtrado por el umbral; 'ok' no puede aparecer, pero el tipo lo cubre.
    const stockLevel = stockLevelOf(row.units)
    if (stockLevel === 'ok') return []
    return [{
      productId: row.productId,
      name: row.name,
      image: row.image,
      units: row.units,
      stockLevel,
      unitCost: row.unitCost,
    }]
  })
  suggestions.sort((a, b) =>
    Number(b.stockLevel === 'out') - Number(a.stockLevel === 'out')
    || a.name.localeCompare(b.name, 'es')
    || a.productId - b.productId,
  )
  return { suggestions }
}
