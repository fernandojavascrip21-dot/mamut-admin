import ExcelJS from 'exceljs'
import { validation } from '@lib/errors'
import { COST_HEADERS, HEADER_SCAN_ROWS, IGNORED_ROW_NAMES, NO_HEADER, PRODUCT_HEADERS, QTY_HEADERS, UNSUPPORTED_FILE } from '../constants'
import { normalizeName } from '../normalize'
import type { HeaderColumns, RawReceiptLine } from '../types'

// Lee la primera hoja de un .xlsx y devuelve los renglones bajo el encabezado con el texto crudo;
// la validación de piezas y costos queda en preview.ts. Un archivo que no abre como .xlsx es 422.
export async function readExcel(bytes: Uint8Array): Promise<RawReceiptLine[]> {
  const workbook = new ExcelJS.Workbook()
  try {
    // exceljs declara su propio tipo Buffer (fusionado con el de Node) que solo acepta un ArrayBuffer
    // completo; se copian los bytes a uno nuevo. JSZip, por dentro, lee ese ArrayBuffer igual.
    const copy = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(copy).set(bytes)
    await workbook.xlsx.load(copy)
  } catch {
    throw validation(UNSUPPORTED_FILE)
  }

  const sheet = workbook.worksheets[0]
  const header = sheet ? findHeader(sheet) : null
  if (!sheet || !header) throw validation(NO_HEADER)

  // Totales y envío no son productos: se ignoran sin motivo (spec §3).
  const ignored: readonly string[] = IGNORED_ROW_NAMES
  const lines: RawReceiptLine[] = []
  for (let number = header.row + 1; number <= sheet.rowCount; number++) {
    const row = sheet.getRow(number)
    if (!hasContent(row, sheet.columnCount)) continue
    const name = cellText(row.getCell(header.product))
    if (ignored.includes(normalizeName(name))) continue
    lines.push({
      position: number,
      name: name || null,
      qty: rawValue(row.getCell(header.qty)),
      unitCost: header.cost === null ? null : (cellText(row.getCell(header.cost)) || null),
    })
  }
  return lines
}

// Busca el encabezado en las primeras filas: la primera con producto y piezas. Las remisiones
// reales ponen la tabla arriba, por eso no se recorre toda la hoja.
function findHeader(sheet: ExcelJS.Worksheet): HeaderColumns | null {
  const last = Math.min(HEADER_SCAN_ROWS, sheet.rowCount)
  for (let number = 1; number <= last; number++) {
    const row = sheet.getRow(number)
    const texts = new Map<number, string>()
    for (let col = 1; col <= sheet.columnCount; col++) {
      texts.set(col, normalizeName(cellText(row.getCell(col))))
    }
    const product = pickColumn(texts, PRODUCT_HEADERS)
    const qty = pickColumn(texts, QTY_HEADERS)
    if (product !== null && qty !== null) {
      return { row: number, product, qty, cost: pickColumn(texts, COST_HEADERS) }
    }
  }
  return null
}

// Columna del sinónimo que va primero en la lista: si hay varias columnas del mismo tipo, gana el
// sinónimo más preferido, y entre columnas iguales, la primera.
function pickColumn(texts: Map<number, string>, synonyms: readonly string[]): number | null {
  for (const synonym of synonyms) {
    for (const [col, text] of texts) {
      if (text === synonym) return col
    }
  }
  return null
}

// Texto que muestra la celda, sin espacios de los extremos. Se usa el texto y no el valor interno
// para que el costo no traiga ruido de flotante (12.300000000001).
function cellText(cell: ExcelJS.Cell): string {
  return cell.text.trim()
}

// Valor de la celda para piezas. Una fórmula trae su resultado en `result`.
function rawValue(cell: ExcelJS.Cell): unknown {
  const value: unknown = cell.value
  if (value !== null && typeof value === 'object' && 'result' in value) return value.result
  return value
}

// Una fila vacía no cuenta: ninguna celda tiene texto.
function hasContent(row: ExcelJS.Row, columns: number): boolean {
  for (let col = 1; col <= columns; col++) {
    if (cellText(row.getCell(col)) !== '') return true
  }
  return false
}
