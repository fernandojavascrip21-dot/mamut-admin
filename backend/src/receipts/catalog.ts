import { productsForMatching } from '@products'
import { requireAdmin } from './access'
import { normalizeName } from './normalize'
import type { ReceiptActor, ReceiptCatalogItem } from './types'

// Catálogo para corregir una remisión (HU-42): solo productos activos, bolsitas incluidas, y de solo
// lectura. Se ordena por nombre sin acentos ni mayúsculas para que la lista del selector sea predecible.
export async function listReceiptProducts(actor: ReceiptActor): Promise<{ products: ReceiptCatalogItem[] }> {
  requireAdmin(actor)
  const rows = await productsForMatching()
  const items = rows
    .filter((row) => row.active)
    .map((row) => ({
      id: row.id,
      name: row.name,
      // La tabla guarda la imagen vacía como texto vacío; la API la responde como null.
      image: row.image === '' ? null : row.image,
      unitCost: row.unitCost,
      units: row.stock,
    }))
    .sort((a, b) => compareNames(a.name, b.name) || a.id - b.id)
  return { products: items }
}

// Compara nombres ya sin acentos ni mayúsculas (normalizeName); el id desempata nombres iguales.
function compareNames(a: string, b: string): number {
  const left = normalizeName(a)
  const right = normalizeName(b)
  if (left === right) return 0
  return left < right ? -1 : 1
}
