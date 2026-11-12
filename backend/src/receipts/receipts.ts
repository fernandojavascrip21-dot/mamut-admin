import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '@db/client'
import { isUniqueViolation, pgConstraintName } from '@db/errors'
import { products, supplierReceiptLines, supplierReceipts } from '@db/schema'
import { lockRows, withTransaction, type Tx } from '@db/transaction'
import { UUID } from '@lib/constants'
import { conflict, notFound, validation } from '@lib/errors'
import { requireMoney } from '@lib/handler'
import { compareMoney } from '@lib/money'
import { insertMovements, type NewStockMovement } from '@stock'
import { requireAdmin } from './access'
import {
  INVALID_FILE_NAME,
  INVALID_LINES_COUNT,
  INVALID_PRODUCT_ID,
  INVALID_QTY,
  INVALID_READ_NAME,
  INVALID_REQUEST_ID,
  INVALID_SOURCE,
  MAX_FILE_NAME_LENGTH,
  MAX_LINES,
  MAX_NAME_LENGTH,
  MAX_QTY,
  PRODUCT_INACTIVE,
  RECEIPT_NOT_FOUND,
  RECEIPT_REQUEST_KEY,
  RECEIPT_SOURCES,
  REQUEST_MISMATCH,
} from './constants'
import { loadReceipt, upsertAlias, type ReceiptLineRow } from './records'
import type {
  ConfirmReceiptInput,
  ConfirmReceiptLineInput,
  Receipt,
  ReceiptActor,
} from './types'

type ProductRow = typeof products.$inferSelect

// Confirma una remisión (spec M9-t41 §3): registra la remisión, sus renglones, las entradas de los
// renglones con producto y los alias, todo en una transacción. Devuelve `replayed: true` si la misma
// petición ya estaba registrada: no escribe nada y responde lo guardado.
export async function confirmReceipt(
  input: ConfirmReceiptInput,
  actor: ReceiptActor,
): Promise<{ receipt: Receipt; replayed: boolean }> {
  requireAdmin(actor)
  const data = validateConfirmInput(input)

  let replayed = await isReplay(data)
  if (!replayed) {
    try {
      replayed = await withTransaction(async (tx) => {
        // El candado por requestId hace que dos peticiones iguales a la vez pasen una después de otra:
        // la segunda encuentra la remisión de la primera y responde como repetición.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.requestId}))`)
        if (await isReplay(data)) return true
        await writeReceipt(tx, data, actor.userId)
        return false
      })
    } catch (err) {
      // Respaldo si el candado no alcanzó: la restricción única de requestId deja una sola remisión.
      if (!isUniqueViolation(err) || pgConstraintName(err) !== RECEIPT_REQUEST_KEY) throw err
      if (!(await isReplay(data))) throw conflict(REQUEST_MISMATCH)
      replayed = true
    }
  }

  // Se relee después del commit para que `units` traiga el stock ya movido.
  const receipt = await loadReceipt(data.requestId)
  if (!receipt) throw new Error('La remisión no quedó registrada')
  return { receipt, replayed }
}

// Una remisión con el mismo requestId: true si los datos son los mismos (repetición), 409 si son
// otros, false si todavía no existe. El nombre del archivo no cuenta para la comparación.
async function isReplay(data: ConfirmReceiptInput): Promise<boolean> {
  const [stored] = await db.select({ id: supplierReceipts.id, source: supplierReceipts.source })
    .from(supplierReceipts)
    .where(eq(supplierReceipts.requestId, data.requestId))
  if (!stored) return false

  const lines = await db.select()
    .from(supplierReceiptLines)
    .where(eq(supplierReceiptLines.receiptId, stored.id))
    .orderBy(supplierReceiptLines.position)
  const same = stored.source === data.source
    && lines.length === data.lines.length
    && lines.every((line, index) => sameLine(line, data.lines[index]!))
  if (!same) throw conflict(REQUEST_MISMATCH)
  return true
}

// Compara un renglón guardado con el que llegó: texto, piezas, producto y costo (por valor, no por texto).
function sameLine(stored: ReceiptLineRow, line: ConfirmReceiptLineInput): boolean {
  if (stored.readName !== line.readName || stored.qty !== line.qty || stored.productId !== line.productId) return false
  if (stored.unitCost === null || line.unitCost === null) return stored.unitCost === line.unitCost
  return compareMoney(stored.unitCost, 4, line.unitCost, 4) === 0
}

// Escribe la remisión dentro de la transacción. Los productos se bloquean antes de leer su costo, para
// que el «costo anterior» sea el de ese momento.
async function writeReceipt(tx: Tx, data: ConfirmReceiptInput, userId: string): Promise<void> {
  const productIds = [...new Set(data.lines.flatMap((line) => (line.productId === null ? [] : [line.productId])))]
  const catalog = await lockProducts(tx, productIds)

  const [receipt] = await tx.insert(supplierReceipts)
    .values({ requestId: data.requestId, source: data.source, fileName: data.fileName, createdBy: userId })
    .returning({ id: supplierReceipts.id })

  const inserted = await tx.insert(supplierReceiptLines)
    .values(data.lines.map((line, index) => ({
      ...lineValues(line, index + 1, catalog),
      receiptId: receipt!.id,
    })))
    .returning()
  const lineIdByPosition = new Map<number, number>(inserted.map((row) => [row.position, row.id] as const))

  // Solo los renglones con producto mueven inventario: son la entrada a bodega de cada uno.
  const movements: NewStockMovement[] = []
  data.lines.forEach((line, index) => {
    if (line.productId === null) return
    movements.push({
      productId: line.productId,
      type: 'purchase',
      qty: line.qty,
      holderProfileId: null,
      createdBy: userId,
      receiptLineId: lineIdByPosition.get(index + 1)!,
    })
  })
  await insertMovements(tx, movements)

  for (const line of data.lines) {
    if (line.productId !== null) await upsertAlias(tx, line.readName, line.productId, userId)
  }
}

// Valores de un renglón. Con producto entra ya (`received`); si el costo leído difiere del guardado,
// solo el costo queda pendiente. Sin producto queda `pending` («Producto nuevo») sin mover inventario.
function lineValues(line: ConfirmReceiptLineInput, position: number, catalog: Map<number, ProductRow>) {
  const product = line.productId === null ? undefined : catalog.get(line.productId)
  const costChanged = product !== undefined && line.unitCost !== null
    && compareMoney(line.unitCost, 4, product.unitCost, 4) !== 0
  return {
    position,
    readName: line.readName,
    qty: line.qty,
    unitCost: line.unitCost,
    productId: line.productId,
    status: product ? 'received' : 'pending',
    costStatus: costChanged ? 'pending' : null,
    previousUnitCost: costChanged ? product.unitCost : null,
  }
}

// Bloquea los productos del request y valida que existan y estén activos. Un producto desactivado da
// 409 antes de tocar nada: la transacción se deshace y no queda ningún renglón.
async function lockProducts(tx: Tx, ids: number[]): Promise<Map<number, ProductRow>> {
  if (ids.length === 0) return new Map<number, ProductRow>()
  const rows = await lockRows(tx, products, inArray(products.id, ids))
  if (rows.length !== ids.length) throw notFound()
  for (const row of rows) {
    if (!row.active) throw conflict(PRODUCT_INACTIVE)
  }
  return new Map<number, ProductRow>(rows.map((row) => [row.id, row] as const))
}

// Validación de la confirmación (422). Devuelve los datos ya normalizados: requestId en minúsculas y
// costos con 4 decimales. El costo pasa por requireMoney: nunca se redondea en silencio.
function validateConfirmInput(input: ConfirmReceiptInput): ConfirmReceiptInput {
  if (!UUID.test(input.requestId)) throw validation(INVALID_REQUEST_ID)
  if (!RECEIPT_SOURCES.includes(input.source)) throw validation(INVALID_SOURCE)
  if (input.fileName !== null && (input.fileName.length < 1 || input.fileName.length > MAX_FILE_NAME_LENGTH)) {
    throw validation(INVALID_FILE_NAME)
  }
  if (input.lines.length < 1 || input.lines.length > MAX_LINES) throw validation(INVALID_LINES_COUNT)

  return {
    requestId: input.requestId.toLowerCase(),
    source: input.source,
    fileName: input.fileName,
    lines: input.lines.map(validateLine),
  }
}

function validateLine(line: ConfirmReceiptLineInput): ConfirmReceiptLineInput {
  if (line.readName.length < 1 || line.readName.length > MAX_NAME_LENGTH) throw validation(INVALID_READ_NAME)
  if (!Number.isSafeInteger(line.qty) || line.qty < 1 || line.qty > MAX_QTY) throw validation(INVALID_QTY)
  if (line.productId !== null && (!Number.isSafeInteger(line.productId) || line.productId < 1)) {
    throw validation(INVALID_PRODUCT_ID)
  }
  const unitCost = line.unitCost === null
    ? null
    : requireMoney({ unitCost: line.unitCost }, 'unitCost', { scale: 4, label: 'El costo' })
  return { ...line, unitCost }
}

// Una remisión por su requestId (spec §3). Un requestId que no es UUID no puede existir: 404.
export async function getReceipt(requestId: string, actor: ReceiptActor): Promise<Receipt> {
  requireAdmin(actor)
  if (!UUID.test(requestId)) throw notFound(RECEIPT_NOT_FOUND)
  const receipt = await loadReceipt(requestId.toLowerCase())
  if (!receipt) throw notFound(RECEIPT_NOT_FOUND)
  return receipt
}
