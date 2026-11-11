import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { db } from '@db/client'
import { products, profiles, stockMovements, vendorStock } from '@db/schema'
import type { Tx } from '@db/transaction'
import { LOW_STOCK_THRESHOLD } from './constants'
import { stockLevelOf, type StockLevel } from './levels'

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
  stockLevel: StockLevel
}

// Una línea de la bodega para vender (HU-17): un producto activo con las piezas de la bodega
// (products.stock, que mantiene el trigger), su precio general y su costo de fábrica.
// Solo la lee el administrador (RNF-04): lleva costo.
export interface WarehouseStockLine {
  productId: number
  name: string
  image: string | null
  units: number
  price: string
  unitCost: string
  stockLevel: StockLevel
}

// Productos activos de la bodega, por nombre, también con 0 piezas: el catálogo de venta decide
// qué mostrar. Los archivados no salen, porque no se pueden vender desde la bodega.
export async function stockOfWarehouse(): Promise<WarehouseStockLine[]> {
  const rows = await db
    .select({
      productId: products.id,
      name: products.name,
      image: products.image,
      units: products.stock,
      price: products.price,
      unitCost: products.unitCost,
    })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.name))
  return rows.map((row) => ({ ...row, image: row.image || null, stockLevel: stockLevelOf(row.units) }))
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
// Incluye productos archivados, porque esas piezas siguen con el vendedor. Con `includeSoldOut`
// (HU-15) entran también las filas con qty = 0: lo que tuvo y se le acabó, sea por una venta o por
// un retiro. Un producto que nunca le dejaron no tiene fila, así que no sale. Por defecto es false:
// HU-09, HU-12 y HU-14 no cambian.
export async function stockOfHolder(
  profileId: string,
  options: { includeSoldOut?: boolean } = {},
): Promise<HolderStockLine[]> {
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
    .where(and(eq(vendorStock.profileId, profileId), (options.includeSoldOut ? gte : gt)(vendorStock.qty, 0)))
    .orderBy(asc(products.name))
  // Solo con filas en 0 hace falta saber cuáles se le retiraron (HU-18): ahí 0 no es «agotado».
  const withdrawn = rows.some((row) => row.units === 0) ? await withdrawnProductIds(profileId) : new Set<number>()
  return rows.map((row) => ({
    ...row,
    image: row.image || null,
    stockLevel: stockLevelOf(row.units, { withdrawn: withdrawn.has(row.productId) }),
  }))
}

// Tipo del último movimiento de un producto para un vendedor (HU-18): distingue «se le acabó
// vendiendo» de «se le retiró todo». Se apoya en stock_movements_product_created_idx.
const lastMovementType = sql<string | null>`(
  select m.type from stock_movements m
  where m.product_id = ${vendorStock.productId} and m.holder_profile_id = ${vendorStock.profileId}
  order by m.id desc limit 1
)`

// Productos en 0 de ese vendedor cuyo último movimiento fue un `return` (HU-18): se le retiró todo,
// así que no se cuentan como agotados.
export async function withdrawnProductIds(holderProfileId: string): Promise<Set<number>> {
  const rows = await db
    .select({ productId: vendorStock.productId })
    .from(vendorStock)
    .where(and(eq(vendorStock.profileId, holderProfileId), eq(vendorStock.qty, 0), sql`${lastMovementType} = 'return'`))
  return new Set(rows.map((row) => row.productId))
}

// Un producto con baja o nula existencia en un titular (HU-18). `holderProfileId` null = bodega.
export interface LowStockLine {
  productId: number
  name: string
  image: string | null
  holderProfileId: string | null
  units: number
  stockLevel: 'low' | 'out'
}

// Un producto que conviene resurtir (base de pedidos, T-36): activo, que no es bolsita y con
// LOW_STOCK_THRESHOLD piezas o menos en la bodega. Solo cuentan las piezas de la bodega.
export interface RestockCandidate {
  productId: number
  name: string
  image: string | null
  units: number
  unitCost: string
}

// Un producto que se puede pedir (HU-31): activo, que no es bolsita, con las piezas de la bodega
// (todos, también los que tienen 0). Lo lee la lista de resurtir para elegir productos del catálogo.
export interface OrderableProduct {
  productId: number
  name: string
  image: string | null
  units: number
  unitCost: string
}

export async function orderableProducts(): Promise<OrderableProduct[]> {
  const rows = await db
    .select({
      productId: products.id,
      name: products.name,
      image: products.image,
      units: products.stock,
      unitCost: products.unitCost,
    })
    .from(products)
    .where(and(eq(products.active, true), isNull(products.parentProductId)))
  return rows.map((row) => ({ ...row, image: row.image || null }))
}

export async function restockCandidates(): Promise<RestockCandidate[]> {
  const rows = await db
    .select({
      productId: products.id,
      name: products.name,
      image: products.image,
      units: products.stock,
      unitCost: products.unitCost,
    })
    .from(products)
    .where(and(
      eq(products.active, true),
      isNull(products.parentProductId),
      lte(products.stock, LOW_STOCK_THRESHOLD),
    ))
  return rows.map((row) => ({ ...row, image: row.image || null }))
}

// Avisos de baja existencia: bodega y vendedores activos, o solo un vendedor si se pasa su id. Solo
// productos activos. En la bodega entra todo producto activo con LOW_STOCK_THRESHOLD piezas o menos;
// en un vendedor, los de 1 a LOW_STOCK_THRESHOLD y los que están en 0 solo si el último movimiento
// no fue un retiro. Orden: agotados primero, luego por nombre, bodega antes que vendedores.
export async function lowStockLines(holderProfileId?: string): Promise<LowStockLine[]> {
  const warehouseRows = holderProfileId
    ? []
    : await db
        .select({ productId: products.id, name: products.name, image: products.image, units: products.stock })
        .from(products)
        .where(and(eq(products.active, true), lte(products.stock, LOW_STOCK_THRESHOLD)))

  const sellerRows = await db
    .select({
      productId: products.id,
      name: products.name,
      image: products.image,
      units: vendorStock.qty,
      holderProfileId: vendorStock.profileId,
    })
    .from(vendorStock)
    .innerJoin(products, eq(products.id, vendorStock.productId))
    .innerJoin(profiles, eq(profiles.id, vendorStock.profileId))
    .where(and(
      eq(products.active, true),
      eq(profiles.active, true),
      eq(profiles.role, 'vendedor'),
      holderProfileId ? eq(vendorStock.profileId, holderProfileId) : undefined,
      lte(vendorStock.qty, LOW_STOCK_THRESHOLD),
      or(gt(vendorStock.qty, 0), sql`${lastMovementType} is distinct from 'return'`),
    ))

  const lines: LowStockLine[] = [
    ...warehouseRows.map((row) => ({ ...row, holderProfileId: null })),
    ...sellerRows,
  ].map((row) => ({
    productId: row.productId,
    name: row.name,
    image: row.image || null,
    holderProfileId: row.holderProfileId,
    units: row.units,
    stockLevel: row.units <= 0 ? 'out' : 'low',
  }))

  return lines.sort((a, b) =>
    Number(b.stockLevel === 'out') - Number(a.stockLevel === 'out')
    || a.name.localeCompare(b.name, 'es')
    || (a.holderProfileId ?? '').localeCompare(b.holderProfileId ?? ''),
  )
}

// Un producto con piezas en algún lugar (HU-13): las de la bodega (products.stock) y las de cada
// vendedor con qty > 0. `image` es null cuando el producto no tiene foto ('' en la base).
// `parentProductId` es el entero del que sale una bolsita (HU-26 §13); null en los demás productos.
export interface ProductHoldings {
  productId: number
  name: string
  image: string | null
  parentProductId: number | null
  warehouse: number
  holders: { profileId: string; units: number }[]
}

// Productos con alguna pieza en la bodega o con algún vendedor, por nombre. Incluye archivados y
// bolsitas, porque esas piezas siguen existiendo. Solo lee: products.stock y vendor_stock.qty son
// una caché que mantienen los movimientos (T-07). Un producto con 0 piezas en todas partes no sale.
export async function holdingsByProduct(): Promise<ProductHoldings[]> {
  const heldByVendor = db
    .select({ productId: vendorStock.productId })
    .from(vendorStock)
    .where(gt(vendorStock.qty, 0))

  const productRows = await db
    .select({
      productId: products.id,
      name: products.name,
      image: products.image,
      parentProductId: products.parentProductId,
      warehouse: products.stock,
    })
    .from(products)
    .where(or(gt(products.stock, 0), inArray(products.id, heldByVendor)))
    .orderBy(asc(products.name), asc(products.id))

  if (productRows.length === 0) return []

  const holderRows = await db
    .select({ productId: vendorStock.productId, profileId: vendorStock.profileId, units: vendorStock.qty })
    .from(vendorStock)
    .where(and(gt(vendorStock.qty, 0), inArray(vendorStock.productId, productRows.map((row) => row.productId))))

  const holdersByProduct = new Map<number, { profileId: string; units: number }[]>()
  for (const { productId, profileId, units } of holderRows) {
    const holders = holdersByProduct.get(productId) ?? []
    holders.push({ profileId, units })
    holdersByProduct.set(productId, holders)
  }

  return productRows.map((row) => ({
    ...row,
    image: row.image || null,
    holders: holdersByProduct.get(row.productId) ?? [],
  }))
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

// La fila de una merma (T-25) con el saldo del titular antes → después. `qty` va en positivo.
export interface ShrinkageMovement {
  requestId: string
  createdAt: string
  productId: number
  holderProfileId: string | null
  qty: number
  reason: string | null
  stock: { before: number; after: number }
}

// Merma registrada con ese requestId, o null si no hay fila `shrinkage` con él (puede ser de una
// entrega o un retiro). El saldo sale de los movimientos hasta esa fila, no de la caché actual, para
// que un GET o una repetición den lo mismo que el primer POST.
export async function movementOfShrinkage(requestId: string): Promise<ShrinkageMovement | null> {
  const [row] = await db
    .select()
    .from(stockMovements)
    .where(and(eq(stockMovements.requestId, requestId), eq(stockMovements.type, 'shrinkage')))
    .orderBy(asc(stockMovements.id))
    .limit(1)
  if (!row) return null
  const after = await balanceUpTo(row.productId, row.holderProfileId, row.id)
  return {
    requestId,
    createdAt: row.createdAt,
    productId: row.productId,
    holderProfileId: row.holderProfileId,
    qty: -row.qty,
    reason: row.reason,
    stock: { before: after - row.qty, after },
  }
}

// La fila de una entrada a bodega (HU-27) con el saldo de la bodega antes → después.
export interface PurchaseMovement {
  requestId: string
  createdAt: string
  productId: number
  qty: number
  stock: { before: number; after: number }
}

// Entrada registrada con ese requestId, o null si no hay fila `purchase` con él. El saldo sale de
// los movimientos hasta esa fila, no de la caché actual, para que un GET o una repetición den lo
// mismo que el primer POST.
export async function movementOfPurchase(requestId: string): Promise<PurchaseMovement | null> {
  const [row] = await db
    .select()
    .from(stockMovements)
    .where(and(eq(stockMovements.requestId, requestId), eq(stockMovements.type, 'purchase')))
    .orderBy(asc(stockMovements.id))
    .limit(1)
  if (!row) return null
  const after = await balanceUpTo(row.productId, row.holderProfileId, row.id)
  return {
    requestId,
    createdAt: row.createdAt,
    productId: row.productId,
    qty: row.qty,
    stock: { before: after - row.qty, after },
  }
}

// Un renglón de venta con el stock del titular antes → después (T-18). `qty` va en positivo.
export interface SaleMovement {
  productId: number
  qty: number
  stock: { before: number; after: number }
}

// Movimientos `direct_sale` de una venta, con los saldos del titular leídos de los movimientos
// (no de la caché actual) para que un GET posterior dé lo mismo que el POST. Por orden de inserción.
export async function movementsOfSale(directSaleId: number): Promise<SaleMovement[]> {
  const rows = await db
    .select()
    .from(stockMovements)
    .where(and(eq(stockMovements.directSaleId, directSaleId), eq(stockMovements.type, 'direct_sale')))
    .orderBy(asc(stockMovements.id))
  return Promise.all(rows.map(async (row) => {
    const after = await balanceUpTo(row.productId, row.holderProfileId, row.id)
    return { productId: row.productId, qty: -row.qty, stock: { before: after - row.qty, after } }
  }))
}
