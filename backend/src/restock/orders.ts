import { asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@db/client'
import { isUniqueViolation } from '@db/errors'
import { products, restockOrderLines, restockOrders } from '@db/schema'
import { lockRows, withTransaction } from '@db/transaction'
import type { Tx } from '@db/transaction'
import { MONEY_MAX, UUID } from '@lib/constants'
import { AppError, conflict, notFound, validation } from '@lib/errors'
import { compareMoney, decimalPlaces, fromMinorUnits, toMinorUnits } from '@lib/money'
import { requireAdmin } from './access'
import {
  DUPLICATE_CUSTOM, DUPLICATE_PRODUCT, EMPTY_ORDER, ESTIMATE_FORMAT, INVALID_CUSTOM_NAME, INVALID_LINE_KIND,
  INVALID_QTY, INVALID_REQUEST_ID, INVALID_STATUS, INVALID_UNIT_COST, LIST_LIMIT, MAX_CUSTOM_NAME_LENGTH,
  MAX_LINES, MAX_NOTE_LENGTH, MAX_QTY, NOTE_TOO_LONG, ORDER_CLOSED, ORDER_MISMATCH, PRODUCT_NOT_ORDERABLE,
  TOO_MANY_LINES,
} from './constants'
import type {
  CreateRestockOrderInput, PlannedLine, RestockActor, RestockCustomLine, RestockLineInput, RestockOrder,
  RestockOrderLine, RestockOrderStatus, RestockOrderSummary, RestockOrdersFilter, UpdateRestockOrderInput,
} from './types'

// Nota vacía o solo espacios → null; si no, se recorta y no pasa del tope.
function normalizeNote(note: string | null): string | null {
  const trimmed = (note ?? '').trim()
  if (trimmed === '') return null
  if (trimmed.length > MAX_NOTE_LENGTH) throw validation(NOTE_TOO_LONG)
  return trimmed
}

// Costo de un renglón: texto de hasta 4 decimales entre 0 y MONEY_MAX[4], normalizado a «4.0000».
// Ausente o null = null (un renglón de catálogo toma entonces su costo; uno escrito cuenta 0 en el total).
// Se valida aquí y no en la ruta, porque el caso de uso también lo recibe directo.
function normalizeUnitCost(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const text = value.trim()
  const decimals = decimalPlaces(text)
  const [integerPart = ''] = text.split('.')
  const maxIntegerDigits = MONEY_MAX[4].split('.')[0]!.length
  // El tope de dígitos enteros va antes que compareMoney: un monto más largo no cabe en un safe integer.
  if (decimals === null || decimals > 4 || integerPart.replace(/^0+(?=\d)/, '').length > maxIntegerDigits) {
    throw validation(INVALID_UNIT_COST)
  }
  if (compareMoney(text, 4, MONEY_MAX[4], 4) > 0) throw validation(INVALID_UNIT_COST)
  return fromMinorUnits(toMinorUnits(text, 4), 4)
}

// Revisa cada renglón (tipo, piezas, nombre, costo) y los repetidos, antes de tocar la base. Los
// productos se revisan dentro de la transacción (orderableCosts), para leer su estado en el momento
// del guardado. Un producto y un nombre escrito con el mismo texto son renglones distintos (permitido).
function planLines(lines: RestockLineInput[]): PlannedLine[] {
  if (lines.length > MAX_LINES) throw validation(TOO_MANY_LINES)
  const seenProducts = new Set<number>()
  const seenNames = new Set<string>()
  return lines.map((line): PlannedLine => {
    if (('productId' in line) === ('name' in line)) throw validation(INVALID_LINE_KIND)
    if (!Number.isSafeInteger(line.qty) || line.qty < 1 || line.qty > MAX_QTY) throw validation(INVALID_QTY)
    if ('name' in line) {
      const name = line.name.trim()
      if (name.length < 1 || name.length > MAX_CUSTOM_NAME_LENGTH) throw validation(INVALID_CUSTOM_NAME)
      // Sin mayúsculas: el índice único de la base usa lower(custom_name), y aquí se avisa antes.
      const key = name.toLowerCase()
      if (seenNames.has(key)) throw validation(DUPLICATE_CUSTOM)
      seenNames.add(key)
      return { kind: 'custom', name, qty: line.qty, unitCost: normalizeUnitCost(line.unitCost) }
    }
    if (seenProducts.has(line.productId)) throw validation(DUPLICATE_PRODUCT)
    seenProducts.add(line.productId)
    return { kind: 'catalog', productId: line.productId, qty: line.qty, unitCost: normalizeUnitCost(line.unitCost) }
  })
}

// Ids de los renglones de catálogo de un pedido.
function catalogIds(lines: PlannedLine[]): number[] {
  return lines.flatMap((line) => (line.kind === 'catalog' ? [line.productId] : []))
}

// Revisa que cada producto de catálogo exista (404), esté activo y no sea bolsita (422). Devuelve el
// costo de fábrica actual de cada uno: es el que se copia a un renglón nuevo sin costo (T-36).
async function orderableCosts(tx: Tx, ids: number[]): Promise<Map<number, string>> {
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

// Clave de un renglón para compararlo con los guardados: el producto, o el nombre sin mayúsculas.
function plannedKey(line: PlannedLine): string {
  return line.kind === 'catalog' ? `p:${line.productId}` : `w:${line.name.toLowerCase()}`
}

function storedKey(productId: number | null, customName: string | null): string {
  return productId !== null ? `p:${productId}` : `w:${(customName ?? '').toLowerCase()}`
}

// Id del pedido guardado con ese requestId, o null si no hay ninguno. Con la misma nota y los mismos
// renglones (en cualquier orden) es el mismo pedido; con otros datos, 409 (HU-27). Un renglón de
// catálogo sin costo pide el costo actual: no hay costo que comparar, así que cualquiera vale.
async function matchingOrderId(tx: Tx, input: { requestId: string; note: string | null; lines: PlannedLine[] }): Promise<number | null> {
  const [saved] = await tx
    .select({ id: restockOrders.id, note: restockOrders.note })
    .from(restockOrders)
    .where(eq(restockOrders.requestId, input.requestId))
  if (!saved) return null
  const stored = await tx
    .select({
      productId: restockOrderLines.productId,
      customName: restockOrderLines.customName,
      qty: restockOrderLines.qty,
      unitCost: restockOrderLines.unitCost,
    })
    .from(restockOrderLines)
    .where(eq(restockOrderLines.orderId, saved.id))
  const byKey = new Map(stored.map((line) => [storedKey(line.productId, line.customName), line] as const))
  const same = saved.note === input.note
    && stored.length === input.lines.length
    && input.lines.every((line) => {
      const found = byKey.get(plannedKey(line))
      if (!found || found.qty !== line.qty) return false
      if (line.kind === 'catalog' && line.unitCost === null) return true
      return found.unitCost === line.unitCost
    })
  if (!same) throw conflict(ORDER_MISMATCH)
  return saved.id
}

// Bloquea el pedido para cambiarlo: 404 si no existe, 409 si ya está cerrado (no hay vuelta atrás).
async function lockDraft(tx: Tx, id: number): Promise<void> {
  const [order] = await lockRows(tx, restockOrders, eq(restockOrders.id, id))
  if (!order) throw notFound()
  if (order.status === 'closed') throw conflict(ORDER_CLOSED)
}

// Inserta los renglones de un pedido. Un renglón de catálogo guarda su costo del pedido; uno escrito
// guarda su nombre y su costo (o null). Ninguno toca products ni inventario.
function lineRows(orderId: number, lines: PlannedLine[], costOf: (line: PlannedLine & { kind: 'catalog' }) => string) {
  return lines.map((line) => line.kind === 'catalog'
    ? { orderId, productId: line.productId, customName: null, qty: line.qty, unitCost: costOf(line) }
    : { orderId, productId: null, customName: line.name, qty: line.qty, unitCost: line.unitCost })
}

// Lee el pedido ya confirmado. Los renglones salen en el orden en que se guardaron (id del renglón);
// los de catálogo van en `lines` y los escritos a mano en `customLines`. El total sale de SQL.
async function readOrder(id: number): Promise<RestockOrder> {
  const [order] = await db.select().from(restockOrders).where(eq(restockOrders.id, id))
  if (!order) throw notFound()
  const rows = await db
    .select({
      id: restockOrderLines.id,
      productId: restockOrderLines.productId,
      customName: restockOrderLines.customName,
      name: products.name,
      image: products.image,
      qty: restockOrderLines.qty,
      unitCost: restockOrderLines.unitCost,
    })
    .from(restockOrderLines)
    .leftJoin(products, eq(products.id, restockOrderLines.productId))
    .where(eq(restockOrderLines.orderId, id))
    .orderBy(asc(restockOrderLines.id))
  // El check de la base garantiza producto, nombre y costo según el tipo de renglón; la guarda solo estrecha el tipo.
  const lines = rows.flatMap((row): RestockOrderLine[] => {
    if (row.productId === null || row.name === null || row.unitCost === null) return []
    return [{
      product: { id: row.productId, name: row.name, image: row.image || null },
      qty: row.qty,
      unitCost: row.unitCost,
    }]
  })
  const customLines = rows.flatMap((row): RestockCustomLine[] => (
    row.customName === null ? [] : [{ id: row.id, name: row.customName, qty: row.qty, unitCost: row.unitCost }]
  ))
  // Un pedido sin renglones igual da una fila (sum sobre cero filas es null, que coalesce vuelve 0).
  // Redondeo a centavos una sola vez, sobre la suma (mitad hacia arriba, como money.ts).
  const [estimate] = await db
    .select({
      total: sql<string>`to_char(round(coalesce(sum(${restockOrderLines.qty} * coalesce(${restockOrderLines.unitCost}, 0)), 0), 2), ${ESTIMATE_FORMAT})`,
    })
    .from(restockOrderLines)
    .where(eq(restockOrderLines.orderId, id))
  return {
    id: order.id,
    // El check de la base solo deja estos dos valores; el cast no puede equivocarse.
    status: order.status as RestockOrderStatus,
    note: order.note,
    requestId: order.requestId,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    closedAt: order.closedAt,
    lineCount: rows.length,
    totalUnits: rows.reduce((total, row) => total + row.qty, 0),
    estimatedTotal: estimate!.total,
    lines,
    customLines,
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
  const request = {
    requestId: input.requestId,
    note: normalizeNote(input.note),
    lines: planLines(input.lines),
  }

  const saved = await withTransaction((tx) => matchingOrderId(tx, request))
  if (saved !== null) return { order: await readOrder(saved), replayed: true }

  try {
    const result = await withTransaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${request.requestId}))`)
      const raced = await matchingOrderId(tx, request)
      if (raced !== null) return { id: raced, replayed: true }

      const costs = await orderableCosts(tx, catalogIds(request.lines))
      const [created] = await tx
        .insert(restockOrders)
        .values({ requestId: request.requestId, note: request.note, createdBy: actor.userId })
        .returning({ id: restockOrders.id })
      // Un insert que no devuelve fila es un fallo interno: 500, no un error de la petición.
      if (!created) throw new AppError('internal', 'El pedido no quedó registrado')
      if (request.lines.length > 0) {
        await tx.insert(restockOrderLines).values(lineRows(created.id, request.lines, (line) =>
          line.unitCost ?? costs.get(line.productId)!))
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

// Reemplaza la nota y toda la lista de renglones de un borrador. Un producto de catálogo que ya
// estaba en el pedido conserva su costo guardado, salvo que venga uno nuevo; uno nuevo toma el costo
// actual. Los renglones escritos a mano llevan el costo que traigan.
export async function updateRestockOrder(
  id: number,
  input: UpdateRestockOrderInput,
  actor: RestockActor,
): Promise<RestockOrder> {
  requireAdmin(actor)
  const note = normalizeNote(input.note)
  const lines = planLines(input.lines)

  await withTransaction(async (tx) => {
    await lockDraft(tx, id)
    const costs = await orderableCosts(tx, catalogIds(lines))
    const saved = await tx
      .select({ productId: restockOrderLines.productId, unitCost: restockOrderLines.unitCost })
      .from(restockOrderLines)
      .where(eq(restockOrderLines.orderId, id))
    const keptCosts = new Map(saved.flatMap((line) => (
      line.productId === null ? [] : [[line.productId, line.unitCost] as const]
    )))

    await tx.delete(restockOrderLines).where(eq(restockOrderLines.orderId, id))
    if (lines.length > 0) {
      await tx.insert(restockOrderLines).values(lineRows(id, lines, (line) =>
        line.unitCost ?? keptCosts.get(line.productId) ?? costs.get(line.productId)!))
    }
    await tx.update(restockOrders).set({ note, updatedAt: sql`now()` }).where(eq(restockOrders.id, id))
  })
  return readOrder(id)
}

// Cierra un borrador con renglones. Sin renglones no se cierra: la lista de compra quedaría vacía.
// Cuentan los dos tipos de renglón.
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
      estimatedTotal: sql<string>`to_char(round(sum(${restockOrderLines.qty} * coalesce(${restockOrderLines.unitCost}, 0)), 2), ${ESTIMATE_FORMAT})`.as('estimated_total'),
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
      // Un pedido sin renglones no aparece en la subconsulta: su total es el de cero piezas.
      estimatedTotal: sql<string>`coalesce(${totals.estimatedTotal}, to_char(0, ${ESTIMATE_FORMAT}))`,
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
