import { asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@db/client'
import { isUniqueViolation } from '@db/errors'
import { products, restockOrderLines, restockOrders } from '@db/schema'
import { lockRows, withTransaction } from '@db/transaction'
import type { Tx } from '@db/transaction'
import { UUID } from '@lib/constants'
import { AppError, conflict, notFound, validation } from '@lib/errors'
import { requireAdmin } from './access'
import {
  DUPLICATE_PRODUCT, EMPTY_ORDER, INVALID_QTY, INVALID_REQUEST_ID, INVALID_STATUS, LIST_LIMIT, MAX_LINES,
  MAX_NOTE_LENGTH, MAX_QTY, NOTE_TOO_LONG, ORDER_CLOSED, ORDER_MISMATCH, PRODUCT_NOT_ORDERABLE, TOO_MANY_LINES,
} from './constants'
import type {
  CreateRestockOrderInput, RestockActor, RestockLineInput, RestockOrder, RestockOrderLine,
  RestockOrderStatus, RestockOrderSummary, RestockOrdersFilter, UpdateRestockOrderInput,
} from './types'

// Nota vacía o solo espacios → null; si no, se recorta y no pasa del tope.
function normalizeNote(note: string | null): string | null {
  const trimmed = (note ?? '').trim()
  if (trimmed === '') return null
  if (trimmed.length > MAX_NOTE_LENGTH) throw validation(NOTE_TOO_LONG)
  return trimmed
}

// Tamaño, cantidades y repetidos. Se revisa antes de tocar la base; los productos se revisan
// dentro de la transacción (orderableCosts), para leer su estado en el mismo momento del guardado.
function checkLineShape(lines: RestockLineInput[]): void {
  if (lines.length > MAX_LINES) throw validation(TOO_MANY_LINES)
  const seen = new Set<number>()
  for (const line of lines) {
    if (!Number.isSafeInteger(line.qty) || line.qty < 1 || line.qty > MAX_QTY) throw validation(INVALID_QTY)
    if (seen.has(line.productId)) throw validation(DUPLICATE_PRODUCT)
    seen.add(line.productId)
  }
}

// Revisa que cada producto exista (404), esté activo y no sea bolsita (422). Devuelve el costo de
// fábrica actual de cada uno: es el que se copia a un renglón nuevo (T-36, costo del momento).
async function orderableCosts(tx: Tx, lines: RestockLineInput[]): Promise<Map<number, string>> {
  const ids = lines.map((line) => line.productId)
  if (ids.length === 0) return new Map()
  const rows = await tx
    .select({
      id: products.id,
      active: products.active,
      parentProductId: products.parentProductId,
      unitCost: products.unitCost,
    })
    .from(products)
    .where(inArray(products.id, ids))
  const byId = new Map(rows.map((row) => [row.id, row] as const))
  for (const id of ids) {
    const row = byId.get(id)
    if (!row) throw notFound()
    if (!row.active || row.parentProductId !== null) throw validation(PRODUCT_NOT_ORDERABLE)
  }
  return new Map(rows.map((row) => [row.id, row.unitCost] as const))
}

// Id del pedido guardado con ese requestId, o null si no hay ninguno. Con la misma nota y los
// mismos renglones (en cualquier orden) es el mismo pedido; con otros datos, 409 (HU-27).
async function matchingOrderId(tx: Tx, input: CreateRestockOrderInput): Promise<number | null> {
  const [saved] = await tx
    .select({ id: restockOrders.id, note: restockOrders.note })
    .from(restockOrders)
    .where(eq(restockOrders.requestId, input.requestId))
  if (!saved) return null
  const stored = await tx
    .select({ productId: restockOrderLines.productId, qty: restockOrderLines.qty })
    .from(restockOrderLines)
    .where(eq(restockOrderLines.orderId, saved.id))
  const qtyByProduct = new Map(stored.map((line) => [line.productId, line.qty] as const))
  const same = saved.note === input.note
    && stored.length === input.lines.length
    && input.lines.every((line) => qtyByProduct.get(line.productId) === line.qty)
  if (!same) throw conflict(ORDER_MISMATCH)
  return saved.id
}

// Bloquea el pedido para cambiarlo: 404 si no existe, 409 si ya está cerrado (no hay vuelta atrás).
async function lockDraft(tx: Tx, id: number): Promise<void> {
  const [order] = await lockRows(tx, restockOrders, eq(restockOrders.id, id))
  if (!order) throw notFound()
  if (order.status === 'closed') throw conflict(ORDER_CLOSED)
}

// Lee el pedido ya confirmado, con sus renglones en el orden en que se guardaron (id del renglón).
async function readOrder(id: number): Promise<RestockOrder> {
  const [order] = await db.select().from(restockOrders).where(eq(restockOrders.id, id))
  if (!order) throw notFound()
  const lineRows = await db
    .select({
      productId: restockOrderLines.productId,
      name: products.name,
      image: products.image,
      qty: restockOrderLines.qty,
      unitCost: restockOrderLines.unitCost,
    })
    .from(restockOrderLines)
    .innerJoin(products, eq(products.id, restockOrderLines.productId))
    .where(eq(restockOrderLines.orderId, id))
    .orderBy(asc(restockOrderLines.id))
  const lines: RestockOrderLine[] = lineRows.map((row) => ({
    product: { id: row.productId, name: row.name, image: row.image || null },
    qty: row.qty,
    unitCost: row.unitCost,
  }))
  return {
    id: order.id,
    // El check de la base solo deja estos dos valores; el cast no puede equivocarse.
    status: order.status as RestockOrderStatus,
    note: order.note,
    requestId: order.requestId,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    closedAt: order.closedAt,
    lineCount: lines.length,
    totalUnits: lines.reduce((total, line) => total + line.qty, 0),
    lines,
  }
}

// Alta idempotente (HU-27). El requestId se revisa dos veces: antes de la transacción (la vía
// normal) y dentro, después de tomar un candado por requestId, para que dos altas iguales a la vez
// dejen un solo pedido. El índice único de la base es la última red.
export async function createRestockOrder(
  input: CreateRestockOrderInput,
  actor: RestockActor,
): Promise<{ order: RestockOrder; replayed: boolean }> {
  requireAdmin(actor)
  if (!UUID.test(input.requestId)) throw validation(INVALID_REQUEST_ID)
  const request: CreateRestockOrderInput = {
    requestId: input.requestId,
    note: normalizeNote(input.note),
    lines: input.lines,
  }
  checkLineShape(request.lines)

  const saved = await withTransaction((tx) => matchingOrderId(tx, request))
  if (saved !== null) return { order: await readOrder(saved), replayed: true }

  try {
    const result = await withTransaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${request.requestId}))`)
      const raced = await matchingOrderId(tx, request)
      if (raced !== null) return { id: raced, replayed: true }

      const costs = await orderableCosts(tx, request.lines)
      const [created] = await tx
        .insert(restockOrders)
        .values({ requestId: request.requestId, note: request.note, createdBy: actor.userId })
        .returning({ id: restockOrders.id })
      // Un insert que no devuelve fila es un fallo interno: 500, no un error de la petición.
      if (!created) throw new AppError('internal', 'El pedido no quedó registrado')
      if (request.lines.length > 0) {
        await tx.insert(restockOrderLines).values(request.lines.map((line) => ({
          orderId: created.id,
          productId: line.productId,
          qty: line.qty,
          unitCost: costs.get(line.productId)!,
        })))
      }
      return { id: created.id, replayed: false }
    })
    return { order: await readOrder(result.id), replayed: result.replayed }
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    const winner = await withTransaction((tx) => matchingOrderId(tx, request))
    if (winner === null) throw conflict(ORDER_MISMATCH)
    return { order: await readOrder(winner), replayed: true }
  }
}

// Reemplaza la nota y toda la lista de renglones de un borrador. Un producto que ya estaba en el
// pedido conserva el costo guardado; uno nuevo toma el costo actual.
export async function updateRestockOrder(
  id: number,
  input: UpdateRestockOrderInput,
  actor: RestockActor,
): Promise<RestockOrder> {
  requireAdmin(actor)
  const note = normalizeNote(input.note)
  checkLineShape(input.lines)

  await withTransaction(async (tx) => {
    await lockDraft(tx, id)
    const costs = await orderableCosts(tx, input.lines)
    const saved = await tx
      .select({ productId: restockOrderLines.productId, unitCost: restockOrderLines.unitCost })
      .from(restockOrderLines)
      .where(eq(restockOrderLines.orderId, id))
    const keptCosts = new Map(saved.map((line) => [line.productId, line.unitCost] as const))

    await tx.delete(restockOrderLines).where(eq(restockOrderLines.orderId, id))
    if (input.lines.length > 0) {
      await tx.insert(restockOrderLines).values(input.lines.map((line) => ({
        orderId: id,
        productId: line.productId,
        qty: line.qty,
        unitCost: keptCosts.get(line.productId) ?? costs.get(line.productId)!,
      })))
    }
    await tx.update(restockOrders).set({ note, updatedAt: sql`now()` }).where(eq(restockOrders.id, id))
  })
  return readOrder(id)
}

// Cierra un borrador con renglones. Sin productos no se cierra: la lista de compra quedaría vacía.
export async function closeRestockOrder(id: number, actor: RestockActor): Promise<RestockOrder> {
  requireAdmin(actor)
  await withTransaction(async (tx) => {
    await lockDraft(tx, id)
    const [first] = await tx
      .select({ id: restockOrderLines.id })
      .from(restockOrderLines)
      .where(eq(restockOrderLines.orderId, id))
      .limit(1)
    if (!first) throw validation(EMPTY_ORDER)
    await tx.update(restockOrders).set({ status: 'closed', closedAt: sql`now()` }).where(eq(restockOrders.id, id))
  })
  return readOrder(id)
}

// Borra un borrador; sus renglones se van por cascada. Un pedido cerrado ya es historia: 409.
export async function deleteRestockOrder(id: number, actor: RestockActor): Promise<void> {
  requireAdmin(actor)
  await withTransaction(async (tx) => {
    await lockDraft(tx, id)
    await tx.delete(restockOrders).where(eq(restockOrders.id, id))
  })
}

// Un pedido con sus renglones (detalle).
export async function getRestockOrder(id: number, actor: RestockActor): Promise<RestockOrder> {
  requireAdmin(actor)
  return readOrder(id)
}

// Los pedidos más recientes (sin renglones), con sus totales calculados en SQL.
export async function listRestockOrders(
  filter: RestockOrdersFilter,
  actor: RestockActor,
): Promise<{ orders: RestockOrderSummary[] }> {
  requireAdmin(actor)
  if (filter.status !== undefined && filter.status !== 'draft' && filter.status !== 'closed') {
    throw validation(INVALID_STATUS)
  }
  // Totales por pedido en una subconsulta agrupada y unida por id. Una subconsulta correlacionada
  // no sirve aquí: drizzle escribe las columnas sin su tabla y «id» se resolvería contra los renglones.
  const totals = db
    .select({
      orderId: restockOrderLines.orderId,
      lineCount: sql<number>`count(*)::int`.as('line_count'),
      // bigint: la suma de muchos renglones puede pasar de int4. postgres.js lo devuelve como texto.
      totalUnits: sql<string>`sum(${restockOrderLines.qty})::bigint`.as('total_units'),
    })
    .from(restockOrderLines)
    .groupBy(restockOrderLines.orderId)
    .as('restock_totals')
  const rows = await db
    .select({
      id: restockOrders.id,
      status: restockOrders.status,
      note: restockOrders.note,
      createdAt: restockOrders.createdAt,
      updatedAt: restockOrders.updatedAt,
      closedAt: restockOrders.closedAt,
      lineCount: sql<number>`coalesce(${totals.lineCount}, 0)`,
      totalUnits: sql<string>`coalesce(${totals.totalUnits}, 0)`,
    })
    .from(restockOrders)
    .leftJoin(totals, eq(totals.orderId, restockOrders.id))
    .where(filter.status ? eq(restockOrders.status, filter.status) : undefined)
    .orderBy(desc(restockOrders.createdAt), desc(restockOrders.id))
    .limit(LIST_LIMIT)
  return {
    orders: rows.map((row) => ({
      ...row,
      status: row.status as RestockOrderStatus,
      totalUnits: Number(row.totalUnits),
    })),
  }
}
