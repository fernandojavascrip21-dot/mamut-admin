import { orderableProducts, stockLevelOf } from '@stock'
import { requireAdmin } from './access'
import type { RestockActor, RestockProduct } from './types'

// Productos que se pueden pedir (HU-31): todos los activos que no son bolsita, también los que tienen
// 0 piezas. Es solo lectura y no usa GET /api/products a propósito: ese no manda costo y lo ve el vendedor.
export async function listRestockProducts(actor: RestockActor): Promise<{ products: RestockProduct[] }> {
  requireAdmin(actor)
  const rows = await orderableProducts()
  const products: RestockProduct[] = rows.map((row) => ({
    ...row,
    stockLevel: stockLevelOf(row.units),
  }))
  products.sort((a, b) => a.name.localeCompare(b.name, 'es') || a.productId - b.productId)
  return { products }
}
