import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm'
import { db } from '@db/client'
import { products, vendorStock } from '@db/schema'

// Una línea del stock de un vendedor: un producto con las piezas que tiene (qty > 0).
// `image` es null cuando el producto no tiene foto (products.image guarda '' en ese caso).
export interface HolderStockLine {
  productId: number
  name: string
  image: string | null
  units: number
}

// Total de piezas de cada vendedor: suma de vendor_stock.qty, que mantiene el trigger a partir de
// los movimientos (T-07); aquí solo se lee. Un vendedor sin filas no aparece en el mapa: vale 0.
export async function unitsByHolder(profileIds: string[]): Promise<Map<string, number>> {
  if (profileIds.length === 0) return new Map()
  const rows = await db
    .select({ profileId: vendorStock.profileId, units: sql<number>`coalesce(sum(${vendorStock.qty}), 0)::int` })
    .from(vendorStock)
    .where(inArray(vendorStock.profileId, profileIds))
    .groupBy(vendorStock.profileId)
  return new Map(rows.map((row) => [row.profileId, row.units]))
}

// Stock de un vendedor por producto (HU-09): solo lo que tiene en mano (qty > 0), por nombre.
// Incluye productos archivados, porque esas piezas siguen con el vendedor.
export async function stockOfHolder(profileId: string): Promise<HolderStockLine[]> {
  const rows = await db
    .select({ productId: products.id, name: products.name, image: products.image, units: vendorStock.qty })
    .from(vendorStock)
    .innerJoin(products, eq(products.id, vendorStock.productId))
    .where(and(eq(vendorStock.profileId, profileId), gt(vendorStock.qty, 0)))
    .orderBy(asc(products.name))
  return rows.map((row) => ({ ...row, image: row.image || null }))
}
