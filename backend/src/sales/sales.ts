import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '@db/client'
import { isUniqueViolation } from '@db/errors'
import { directSaleItems, directSales, products, vendorStock } from '@db/schema'
import { lockRows, withTransaction } from '@db/transaction'
import { getActiveSellerName, getSellerName } from '@accounts'
import { findProduct } from '@products'
import { insertMovements, movementsOfSale } from '@stock'
import { conflict, forbidden, notFound, validation } from '@lib/errors'
import { toMinorUnits } from '@lib/money'
import { DUPLICATE_PRODUCT, MAX_LINES, MAX_QTY, SALE_MISMATCH } from './constants'

export interface CreateSaleInput {
  requestId: string
  holderId: string | null | undefined // null = bodega; para un vendedor siempre es su id
  lines: { productId: number; qty: number }[]
}

// Quien registra la venta. `role` es el de AuthContext; aquí solo importa si es administrador.
export interface SaleActor {
  userId: string
  role: string
}

export interface SaleLine {
  productId: number
  name: string
  image: string | null
  qty: number
  unitPrice: string
  subtotal: string
  stock: { before: number; after: number }
  unitCost?: string // solo administrador
  profit?: string // solo administrador
}

export interface Sale {
  id: number
  requestId: string
  soldAt: string
  soldById: string
  holder: { id: string; fullName: string } | null
  lines: SaleLine[]
  total: string
  profit?: string // solo administrador
}

type SaleRow = typeof directSales.$inferSelect

// Entero BigInt en la unidad mínima → texto decimal ("45050", 2 → "450.50"). BigInt porque
// `qty × precio` de varios renglones puede pasar de 2^53 antes de llegar a texto.
function formatMinor(units: bigint, scale: number): string {
  const digits = (units < BigInt(0) ? -units : units).toString().padStart(scale + 1, '0')
  return `${units < BigInt(0) ? '-' : ''}${digits.slice(0, -scale)}.${digits.slice(-scale)}`
}

// Diezmilésimas → centavos, mitad hacia arriba (hacia +∞), una sola vez (T-08).
function roundToCents(tenThousandths: bigint): bigint {
  const shifted = tenThousandths + BigInt(50)
  const quotient = shifted / BigInt(100)
  return shifted % BigInt(100) < BigInt(0) ? quotient - BigInt(1) : quotient
}

// Ganancia de un renglón o de la venta en diezmilésimas: qty × (precio − costo).
const profitTenThousandths = (qty: number, unitPrice: string, unitCost: string): bigint =>
  BigInt(qty) * (BigInt(toMinorUnits(unitPrice, 2)) * BigInt(100) - BigInt(toMinorUnits(unitCost, 4)))

// Valida la forma de los renglones (la ruta ya comprobó los tipos). Todo error es 422.
function assertLines(lines: CreateSaleInput['lines']): void {
  if (lines.length === 0) throw validation('La venta necesita al menos un producto')
  if (lines.length > MAX_LINES) throw validation(`La venta admite hasta ${MAX_LINES} productos`)
  const seen = new Set<number>()
  for (const line of lines) {
    if (!Number.isSafeInteger(line.qty) || line.qty <= 0) throw validation('El campo qty debe ser un entero mayor a 0')
    if (line.qty > MAX_QTY) throw validation('El campo qty es demasiado grande')
    if (seen.has(line.productId)) throw validation(DUPLICATE_PRODUCT)
    seen.add(line.productId)
  }
}

// De quién es el stock que se vende. El vendedor solo vende del suyo (403 si pide otro o la bodega);
// el administrador, de la bodega o de un vendedor activo (404 si no lo es).
async function resolveHolder(input: CreateSaleInput, actor: SaleActor): Promise<string | null> {
  if (actor.role === 'admin') {
    if (input.holderId === undefined || input.holderId === null) return null
    await getActiveSellerName(input.holderId)
    return input.holderId
  }
  if (input.holderId !== undefined && input.holderId !== actor.userId) throw forbidden()
  return actor.userId
}

// Arma la respuesta de una venta ya guardada. Precio y costo salen de sus renglones (los del momento),
// los saldos de los movimientos. A quien no es administrador se le quitan `unitCost` y `profit` (RNF-04).
async function toSale(row: SaleRow, actor: SaleActor): Promise<Sale> {
  const isAdmin = actor.role === 'admin'
  const [items, moved, holder] = await Promise.all([
    db
      .select({
        productId: directSaleItems.productId,
        qty: directSaleItems.qty,
        unitPrice: directSaleItems.unitPrice,
        unitCost: directSaleItems.unitCost,
        name: products.name,
        image: products.image,
      })
      .from(directSaleItems)
      .innerJoin(products, eq(products.id, directSaleItems.productId))
      .where(eq(directSaleItems.directSaleId, row.id))
      .orderBy(asc(directSaleItems.id)),
    movementsOfSale(row.id),
    row.holderProfileId ? getSellerName(row.holderProfileId) : Promise.resolve(null),
  ])
  const stockOf = new Map(moved.map((movement) => [movement.productId, movement.stock]))

  let total = BigInt(0)
  let profit = BigInt(0)
  const lines = items.map((item): SaleLine => {
    const subtotal = BigInt(item.qty) * BigInt(toMinorUnits(item.unitPrice, 2))
    const lineProfit = profitTenThousandths(item.qty, item.unitPrice, item.unitCost)
    total += subtotal
    profit += lineProfit
    const line: SaleLine = {
      productId: item.productId,
      name: item.name,
      image: item.image || null,
      qty: item.qty,
      unitPrice: item.unitPrice,
      subtotal: formatMinor(subtotal, 2),
      stock: stockOf.get(item.productId) ?? { before: 0, after: 0 },
    }
    if (isAdmin) {
      line.unitCost = item.unitCost
      line.profit = formatMinor(roundToCents(lineProfit), 2)
    }
    return line
  })

  const sale: Sale = {
    id: row.id,
    requestId: row.requestId ?? '',
    soldAt: row.soldAt,
    soldById: row.soldBy,
    holder,
    lines,
    total: formatMinor(total, 2),
  }
  if (isAdmin) sale.profit = formatMinor(roundToCents(profit), 2)
  return sale
}

// Si el requestId ya existe: con el mismo titular, la misma cuenta y el mismo conjunto de renglones
// (sin importar el orden) devuelve esa venta; con otros datos lanza 409.
async function findReplay(input: CreateSaleInput, holder: string | null, actor: SaleActor): Promise<Sale | null> {
  const [row] = await db.select().from(directSales).where(eq(directSales.requestId, input.requestId))
  if (!row) return null
  const items = await db
    .select({ productId: directSaleItems.productId, qty: directSaleItems.qty })
    .from(directSaleItems)
    .where(eq(directSaleItems.directSaleId, row.id))
  const sameLines =
    items.length === input.lines.length &&
    input.lines.every((line) => items.some((item) => item.productId === line.productId && item.qty === line.qty))
  if (row.soldBy !== actor.userId || row.holderProfileId !== holder || !sameLines) throw conflict(SALE_MISMATCH)
  return toSale(row, actor)
}

// Registra una venta (T-18): la venta, sus renglones con el precio y el costo del momento y un
// movimiento `direct_sale` por producto, en una sola transacción. Nunca escribe qty: si algún renglón
// no alcanza, insertMovements lanza 409 y no queda nada. El requestId la hace idempotente: repetirla
// responde la venta ya hecha (replayed: true) y, si dos iguales llegan a la vez, el índice único deja
// pasar una y la otra cae en esa misma respuesta.
export async function createSale(
  input: CreateSaleInput,
  actor: SaleActor,
): Promise<{ sale: Sale; replayed: boolean }> {
  assertLines(input.lines)
  const holder = await resolveHolder(input, actor)

  const replay = await findReplay(input, holder, actor)
  if (replay) return { sale: replay, replayed: true }

  // 404 si algún producto no existe; los archivados sí se venden si el titular tiene piezas.
  await Promise.all(input.lines.map((line) => findProduct(line.productId)))

  try {
    await withTransaction(async (tx) => {
      // Se bloquean los saldos del titular (en orden de id, contra interbloqueos) antes de leer
      // los precios, para que dos ventas a la vez del mismo producto no vendan más de lo que hay.
      const ids = input.lines.map((line) => line.productId).sort((a, b) => a - b)
      const productRows = await lockRows(tx, products, inArray(products.id, ids))
      const heldRows = holder
        ? await lockRows(tx, vendorStock, inArray(vendorStock.productId, ids))
        : []
      const productOf = new Map(productRows.map((row) => [row.id, row]))
      const heldOf = new Map(heldRows.filter((row) => row.profileId === holder).map((row) => [row.productId, row]))

      const [sale] = await tx
        .insert(directSales)
        .values({ soldBy: actor.userId, holderProfileId: holder, requestId: input.requestId })
        .returning({ id: directSales.id })
      if (!sale) throw new Error('La venta no quedó registrada')

      await tx.insert(directSaleItems).values(input.lines.map((line) => {
        const product = productOf.get(line.productId)
        if (!product) throw notFound()
        const held = heldOf.get(line.productId)
        return {
          directSaleId: sale.id,
          productId: line.productId,
          qty: line.qty,
          unitPrice: held?.unitPrice ?? product.price,
          unitCost: held?.unitCostWithShipping ?? product.unitCost,
        }
      }))

      await insertMovements(tx, input.lines.map((line) => ({
        productId: line.productId,
        type: 'direct_sale' as const,
        qty: -line.qty,
        holderProfileId: holder,
        createdBy: actor.userId,
        directSaleId: sale.id,
      })))
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      const raced = await findReplay(input, holder, actor)
      if (raced) return { sale: raced, replayed: true }
    }
    throw err
  }

  const [row] = await db.select().from(directSales).where(eq(directSales.requestId, input.requestId))
  if (!row) throw new Error('La venta no quedó registrada')
  return { sale: await toSale(row, actor), replayed: false }
}

// Resumen de una venta por su requestId; sobrevive a una recarga. El vendedor solo ve las ventas
// de su stock (otra da 404); el administrador ve cualquiera.
export async function getSale(requestId: string, actor: SaleActor): Promise<Sale> {
  const [row] = await db.select().from(directSales).where(eq(directSales.requestId, requestId))
  if (!row) throw notFound()
  if (actor.role !== 'admin' && row.holderProfileId !== actor.userId) throw notFound()
  return toSale(row, actor)
}
