import { and, asc, desc, eq, gt, inArray, isNull, lt, lte, sql } from 'drizzle-orm'
import { db } from '@db/client'
import { products, stockMovements, vendorStock } from '@db/schema'
import type { Tx } from '@db/transaction'

// Una línea del stock de un vendedor: un producto con las piezas que tiene (qty > 0).
// `image` es null cuando el producto no tiene foto (products.image guarda '' en ese caso).
// `price` y `unitCost` son los generales del producto; `unitPrice` y `unitCostWithShipping` son los
// propios del vendedor (HU-11), null = usa los generales. `warehouseUnits` son las piezas de la bodega
// de ese producto (products.stock), para la vista previa de un retiro (HU-12).
// Solo los lee el administrador (RNF-04).
export interface HolderStockLine {
  productId: number
  name: string
  image: string | null
  units: number
  warehouseUnits: number
  price: string
  unitCost: string
  unitPrice: string | null
  unitCostWithShipping: string | null
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
    .select({
      productId: products.id,
      name: products.name,
      image: products.image,
      units: vendorStock.qty,
      warehouseUnits: products.stock,
      price: products.price,
      unitCost: products.unitCost,
      unitPrice: vendorStock.unitPrice,
      unitCostWithShipping: vendorStock.unitCostWithShipping,
    })
    .from(vendorStock)
    .innerJoin(products, eq(products.id, vendorStock.productId))
    .where(and(eq(vendorStock.profileId, profileId), gt(vendorStock.qty, 0)))
    .orderBy(asc(products.name))
  return rows.map((row) => ({ ...row, image: row.image || null }))
}

// Lo que un vendedor ya tiene de un producto, aunque sean 0 piezas (HU-11): la ventana de «Dejar»
// se prellena con sus precios vigentes. Sin fila en vendor_stock: 0 piezas y los dos precios en null.
export interface HolderHolding {
  units: number
  unitPrice: string | null
  unitCostWithShipping: string | null
}

export async function holdingOf(profileId: string, productId: number): Promise<HolderHolding> {
  const [row] = await db
    .select({ units: vendorStock.qty, unitPrice: vendorStock.unitPrice, unitCostWithShipping: vendorStock.unitCostWithShipping })
    .from(vendorStock)
    .where(and(eq(vendorStock.profileId, profileId), eq(vendorStock.productId, productId)))
  return row ?? { units: 0, unitPrice: null, unitCostWithShipping: null }
}

// Precio y costo con envío propios del vendedor para un producto (RF-26, RF-27). Se guardan los dos
// tal como llegan: null borra el propio anterior y vuelve a los generales. No toca qty, que solo
// cambia con movimientos (T-07); la fila ya existe porque el trigger la crea con el primer movimiento.
export async function setHolderPrices(
  tx: Tx,
  profileId: string,
  productId: number,
  prices: { unitPrice: string | null; unitCostWithShipping: string | null },
): Promise<void> {
  await tx
    .update(vendorStock)
    .set({ unitPrice: prices.unitPrice, unitCostWithShipping: prices.unitCostWithShipping })
    .where(and(eq(vendorStock.profileId, profileId), eq(vendorStock.productId, productId)))
}

// Una entrega del historial del vendedor (HU-11). `requestId` es null en las entregas anteriores a
// la llave de idempotencia (p. ej. las del seed), que por eso no tienen resumen.
export interface DeliveryRow {
  requestId: string | null
  createdAt: string
  productId: number
  name: string
  image: string | null
  qty: number
}

// Últimas entregas de un vendedor: la fila de su lado (qty > 0) de cada movimiento `delivery`,
// de la más nueva a la más vieja.
export async function listDeliveries(profileId: string, limit: number): Promise<DeliveryRow[]> {
  const rows = await db
    .select({
      requestId: stockMovements.requestId,
      createdAt: stockMovements.createdAt,
      productId: products.id,
      name: products.name,
      image: products.image,
      qty: stockMovements.qty,
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .where(and(
      eq(stockMovements.type, 'delivery'),
      eq(stockMovements.holderProfileId, profileId),
      gt(stockMovements.qty, 0),
    ))
    .orderBy(desc(stockMovements.id))
    .limit(limit)
  return rows.map((row) => ({ ...row, image: row.image || null }))
}

// Un retiro del historial del vendedor (HU-12). `qty` va en positivo. `requestId` es null en un
// movimiento `return` creado fuera de este flujo (p. ej. desde Studio), que por eso no tiene resumen.
export interface ReturnRow {
  requestId: string | null
  createdAt: string
  productId: number
  name: string
  image: string | null
  qty: number
}

// Últimos retiros de un vendedor: la fila de su lado (qty < 0) de cada movimiento `return`,
// de la más nueva a la más vieja.
export async function listReturns(profileId: string, limit: number): Promise<ReturnRow[]> {
  const rows = await db
    .select({
      requestId: stockMovements.requestId,
      createdAt: stockMovements.createdAt,
      productId: products.id,
      name: products.name,
      image: products.image,
      qty: stockMovements.qty,
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .where(and(
      eq(stockMovements.type, 'return'),
      eq(stockMovements.holderProfileId, profileId),
      lt(stockMovements.qty, 0),
    ))
    .orderBy(desc(stockMovements.id))
    .limit(limit)
  return rows.map((row) => ({ ...row, image: row.image || null, qty: -row.qty }))
}

// Las dos filas de una entrega o de un retiro más los saldos antes y después de cada lado.
// `qty` siempre es positivo: son las piezas que se movieron, sin importar el sentido.
export interface RequestMovements {
  requestId: string
  createdAt: string
  productId: number
  sellerId: string
  qty: number
  warehouse: { before: number; after: number }
  sellerStock: { before: number; after: number }
}

// Saldo de un producto en manos de `holder` (null = bodega) hasta el movimiento `upToId`, sumando
// movimientos y no leyendo la caché actual, para que una consulta posterior dé lo mismo que la primera.
async function balanceUpTo(productId: number, holder: string | null, upToId: number): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${stockMovements.qty}), 0)::int` })
    .from(stockMovements)
    .where(and(
      eq(stockMovements.productId, productId),
      holder === null ? isNull(stockMovements.holderProfileId) : eq(stockMovements.holderProfileId, holder),
      lte(stockMovements.id, upToId),
    ))
  return row?.total ?? 0
}

// Entrega (HU-11) o retiro (HU-12) registrado con ese requestId, o null si no existe o es del otro
// tipo: así el resumen de una entrega nunca muestra un retiro, ni al revés.
export async function movementsOfRequest(
  requestId: string,
  type: 'delivery' | 'return',
): Promise<RequestMovements | null> {
  const rows = await db
    .select()
    .from(stockMovements)
    .where(and(eq(stockMovements.requestId, requestId), eq(stockMovements.type, type)))
  const sellerRow = rows.find((row) => row.holderProfileId !== null)
  const warehouseRow = rows.find((row) => row.holderProfileId === null)
  if (!sellerRow || !warehouseRow || !sellerRow.holderProfileId) return null

  const [warehouseAfter, sellerAfter] = await Promise.all([
    balanceUpTo(sellerRow.productId, null, warehouseRow.id),
    balanceUpTo(sellerRow.productId, sellerRow.holderProfileId, sellerRow.id),
  ])
  return {
    requestId,
    createdAt: sellerRow.createdAt,
    productId: sellerRow.productId,
    sellerId: sellerRow.holderProfileId,
    qty: Math.abs(sellerRow.qty),
    warehouse: { before: warehouseAfter - warehouseRow.qty, after: warehouseAfter },
    sellerStock: { before: sellerAfter - sellerRow.qty, after: sellerAfter },
  }
}
