import { asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '@db/client'
import { isForeignKeyViolation, isUniqueViolation } from '@db/errors'
import { products, supplierReceiptLines, supplierReceipts } from '@db/schema'
import { lockRows, withTransaction, type Tx } from '@db/transaction'
import { conflict, notFound, validation } from '@lib/errors'
import { compareMoney } from '@lib/money'
import { DUPLICATE_NAME, insertProduct, PRICE_BELOW_COST, setUnitCost } from '@products'
import { insertMovements } from '@stock'
import { requireAdmin } from './access'
import {
  CATEGORY_NOT_FOUND,
  COST_ABOVE_PRICE,
  LINE_ALREADY_RESOLVED,
  LINE_NOT_FOUND,
  MISSING_UNIT_COST,
  PENDING_LIMIT,
  PRODUCT_INACTIVE,
} from './constants'
import { suggestedName } from './normalize'
import { toProductRef, toReceiptLine, upsertAlias, type ReceiptLineRow } from './records'
import type {
  AcceptLineCostResult,
  CreateProductFromLineInput,
  CreateProductFromLineResult,
  PendingReceiptLines,
  ReceiptActor,
  ReceiptLine,
} from './types'

// Pendientes de la remisión (spec M9-t41 §3): renglones sin producto y cambios de costo. Las dos listas
// van juntas; el filtro entre ellas es de la pantalla HU-42.
export async function listPendingReceiptLines(actor: ReceiptActor): Promise<PendingReceiptLines> {
  requireAdmin(actor)

  const newRows = await db.select({
    line: supplierReceiptLines,
    requestId: supplierReceipts.requestId,
    createdAt: supplierReceipts.createdAt,
  })
    .from(supplierReceiptLines)
    .innerJoin(supplierReceipts, eq(supplierReceipts.id, supplierReceiptLines.receiptId))
    .where(eq(supplierReceiptLines.status, 'pending'))
    .orderBy(desc(supplierReceipts.createdAt), asc(supplierReceiptLines.position))
    .limit(PENDING_LIMIT)

  const costRows = await db.select({
    line: supplierReceiptLines,
    requestId: supplierReceipts.requestId,
    createdAt: supplierReceipts.createdAt,
    product: products,
  })
    .from(supplierReceiptLines)
    .innerJoin(supplierReceipts, eq(supplierReceipts.id, supplierReceiptLines.receiptId))
    .innerJoin(products, eq(products.id, supplierReceiptLines.productId))
    .where(eq(supplierReceiptLines.costStatus, 'pending'))
    .orderBy(desc(supplierReceipts.createdAt), asc(supplierReceiptLines.position))
    .limit(PENDING_LIMIT)

  return {
    newProducts: newRows.map((row) => ({
      lineId: row.line.id,
      receipt: { requestId: row.requestId, createdAt: row.createdAt },
      suggestedName: suggestedName(row.line.readName),
      qty: row.line.qty,
      unitCost: row.line.unitCost,
    })),
    costChanges: costRows.map((row) => ({
      lineId: row.line.id,
      receipt: { requestId: row.requestId, createdAt: row.createdAt },
      product: { ...toProductRef(row.product), active: row.product.active },
      qty: row.line.qty,
      currentUnitCost: row.product.unitCost,
      previousUnitCost: required(row.line.previousUnitCost, 'el costo anterior'),
      newUnitCost: required(row.line.unitCost, 'el costo nuevo'),
    })),
  }
}

// Da de alta el producto de un renglón pendiente (spec §3): el producto nace con stock 0 y sus piezas
// entran como `purchase` ligado al renglón, en la misma transacción. El renglón queda `created`.
export async function createProductFromLine(
  lineId: number,
  input: CreateProductFromLineInput,
  actor: ReceiptActor,
): Promise<CreateProductFromLineResult> {
  requireAdmin(actor)
  try {
    return await withTransaction(async (tx) => {
      const line = await lockLine(tx, lineId)
      if (line.status !== 'pending') throw conflict(LINE_ALREADY_RESOLVED)

      // El costo es el que escribió el administrador o, si no lo dio, el que leyó la remisión.
      const unitCost = input.unitCost ?? line.unitCost
      if (unitCost === null) throw validation(MISSING_UNIT_COST)
      if (compareMoney(input.price, 2, unitCost, 4) < 0) throw validation(PRICE_BELOW_COST)

      // Alta como HU-04 sin foto ni fraccionado. initialQty no aplica: las piezas entran como movimiento.
      const created = await insertProduct(tx, {
        name: input.name,
        categoryId: input.categoryId,
        price: input.price,
        unitCost,
        initialQty: 0,
        fractionable: false,
        portionSize: null,
        image: null,
      })
      await insertMovements(tx, [{
        productId: created.id,
        type: 'purchase',
        qty: line.qty,
        holderProfileId: null,
        createdBy: actor.userId,
        receiptLineId: line.id,
      }])
      const [updated] = await tx.update(supplierReceiptLines)
        .set({ status: 'created', productId: created.id, resolvedAt: sql`now()`, resolvedBy: actor.userId })
        .where(eq(supplierReceiptLines.id, line.id))
        .returning()
      await upsertAlias(tx, line.readName, created.id, actor.userId)

      // Se relee para que el stock sea el que quedó tras el movimiento.
      const [product] = await tx.select().from(products).where(eq(products.id, created.id))
      if (!product || !updated) throw notFound()
      return {
        product,
        line: toReceiptLine(updated, toProductRef(product)),
        stock: { before: 0, after: product.stock },
      }
    })
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(DUPLICATE_NAME)
    if (isForeignKeyViolation(err)) throw validation(CATEGORY_NOT_FOUND)
    throw err
  }
}

// Descarta un producto nuevo: sus piezas nunca entran a bodega.
export async function discardLine(lineId: number, actor: ReceiptActor): Promise<{ line: ReceiptLine }> {
  requireAdmin(actor)
  return withTransaction(async (tx) => {
    const line = await lockLine(tx, lineId)
    if (line.status !== 'pending') throw conflict(LINE_ALREADY_RESOLVED)
    const [updated] = await tx.update(supplierReceiptLines)
      .set({ status: 'discarded', resolvedAt: sql`now()`, resolvedBy: actor.userId })
      .where(eq(supplierReceiptLines.id, line.id))
      .returning()
    return { line: toReceiptLine(required(updated ?? null, 'el renglón'), null) }
  })
}

// Acepta el costo nuevo: cambia products.unit_cost. Con precio menor que el costo nuevo no se acepta:
// primero hay que editar el precio (spec §3).
export async function acceptLineCost(lineId: number, actor: ReceiptActor): Promise<AcceptLineCostResult> {
  requireAdmin(actor)
  return withTransaction(async (tx) => {
    const line = await lockLine(tx, lineId)
    if (line.costStatus !== 'pending') throw conflict(LINE_ALREADY_RESOLVED)

    const [product] = await lockRows(tx, products, eq(products.id, productIdOf(line)))
    if (!product) throw notFound()
    if (!product.active) throw conflict(PRODUCT_INACTIVE)

    const newUnitCost = required(line.unitCost, 'el costo nuevo')
    if (compareMoney(product.price, 2, newUnitCost, 4) < 0) throw validation(COST_ABOVE_PRICE)

    await setUnitCost(tx, product.id, newUnitCost)
    const [updated] = await tx.update(supplierReceiptLines)
      .set({ costStatus: 'accepted', resolvedAt: sql`now()`, resolvedBy: actor.userId })
      .where(eq(supplierReceiptLines.id, line.id))
      .returning()
    return {
      line: toReceiptLine(required(updated ?? null, 'el renglón'), toProductRef(product)),
      product: { id: product.id, unitCost: newUnitCost },
    }
  })
}

// Rechaza el costo nuevo: el costo del producto no cambia.
export async function rejectLineCost(lineId: number, actor: ReceiptActor): Promise<{ line: ReceiptLine }> {
  requireAdmin(actor)
  return withTransaction(async (tx) => {
    const line = await lockLine(tx, lineId)
    if (line.costStatus !== 'pending') throw conflict(LINE_ALREADY_RESOLVED)

    const [product] = await tx.select().from(products).where(eq(products.id, productIdOf(line)))
    const [updated] = await tx.update(supplierReceiptLines)
      .set({ costStatus: 'rejected', resolvedAt: sql`now()`, resolvedBy: actor.userId })
      .where(eq(supplierReceiptLines.id, line.id))
      .returning()
    return {
      line: toReceiptLine(required(updated ?? null, 'el renglón'), product ? toProductRef(product) : null),
    }
  })
}

// Bloquea el renglón dentro de la transacción: dos acciones sobre el mismo pendiente se atienden una
// después de otra, y la segunda ve que ya se resolvió.
async function lockLine(tx: Tx, lineId: number): Promise<ReceiptLineRow> {
  const [line] = await lockRows(tx, supplierReceiptLines, eq(supplierReceiptLines.id, lineId))
  if (!line) throw notFound(LINE_NOT_FOUND)
  return line
}

// Un cambio de costo pendiente siempre tiene producto: lo garantiza el CHECK de la base.
function productIdOf(line: ReceiptLineRow): number {
  return required(line.productId, 'el producto del renglón')
}

// Los CHECK de la base garantizan estos valores cuando hay un cambio de costo pendiente. Si faltan,
// es un error del servidor, no del usuario.
function required<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`Falta ${what} en un renglón de remisión`)
  return value
}
