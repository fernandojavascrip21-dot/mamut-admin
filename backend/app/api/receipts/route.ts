import { requireRole } from '@auth'
import { validation } from '@lib/errors'
import { handle, readJson } from '@lib/handler'
import {
  confirmReceipt,
  INVALID_FILE_NAME,
  INVALID_LINE,
  INVALID_LINES_COUNT,
  INVALID_PRODUCT_ID,
  INVALID_READ_NAME,
  INVALID_QTY,
  INVALID_REQUEST_ID,
  INVALID_SOURCE,
  INVALID_UNIT_COST,
  RECEIPT_SOURCES,
  type ConfirmReceiptInput,
  type ConfirmReceiptLineInput,
} from '@receipts'

// Confirma la remisión (HU-42): 201 la primera vez, 200 si es la misma petición repetida. Solo
// administrador. Aquí solo se revisa la forma del cuerpo; los valores los valida el caso de uso.
export const POST = handle(async (request) => {
  const actor = await requireRole(request, 'admin')
  const body = await readJson(request)
  const { receipt, replayed } = await confirmReceipt(parseConfirm(body), actor)
  return Response.json({ receipt, replayed }, { status: replayed ? 200 : 201 })
})

function parseConfirm(body: Record<string, unknown>): ConfirmReceiptInput {
  const source = RECEIPT_SOURCES.find((value) => value === body['source'])
  if (!source) throw validation(INVALID_SOURCE)

  const requestId = body['requestId']
  if (typeof requestId !== 'string') throw validation(INVALID_REQUEST_ID)

  const fileName = body['fileName']
  if (fileName !== undefined && fileName !== null && typeof fileName !== 'string') throw validation(INVALID_FILE_NAME)

  const lines: unknown = body['lines']
  if (!Array.isArray(lines)) throw validation(INVALID_LINES_COUNT)

  return {
    requestId,
    source,
    fileName: typeof fileName === 'string' ? fileName : null,
    lines: lines.map(parseLine),
  }
}

// Un renglón: texto, piezas, costo (texto o número, o null) y producto (número o null).
function parseLine(value: unknown): ConfirmReceiptLineInput {
  if (typeof value !== 'object' || value === null) throw validation(INVALID_LINE)
  const line = value as Record<string, unknown>

  const readName = line['readName']
  if (typeof readName !== 'string') throw validation(INVALID_READ_NAME)

  const qty = line['qty']
  if (typeof qty !== 'number') throw validation(INVALID_QTY)

  const unitCost = line['unitCost']
  let cost: string | null = null
  if (typeof unitCost === 'string' || typeof unitCost === 'number') cost = String(unitCost)
  else if (unitCost !== undefined && unitCost !== null) throw validation(INVALID_UNIT_COST)

  const productId = line['productId']
  if (productId !== undefined && productId !== null && typeof productId !== 'number') throw validation(INVALID_PRODUCT_ID)

  return { readName, qty, unitCost: cost, productId: typeof productId === 'number' ? productId : null }
}
