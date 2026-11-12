import { inArray } from 'drizzle-orm'
import { MONEY_MAX } from '@lib/constants'
import { db } from '@db/client'
import { supplierProductAliases } from '@db/schema'
import { validation } from '@lib/errors'
import { compareMoney, decimalPlaces } from '@lib/money'
import { productsForMatching } from '@products'
import { requireAdmin } from './access'
import {
  DIGITS_ONLY,
  FILE_TOO_LARGE,
  IGNORED_ROW_NAMES,
  IMAGE_TOO_LARGE,
  JPEG_SIGNATURE,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
  MAX_LINES,
  MAX_PDF_PAGES,
  MAX_QTY,
  PDF_PAGE_MARK,
  PDF_SIGNATURE,
  PDF_TOO_MANY_PAGES,
  PNG_SIGNATURE,
  SKIP_LABELS,
  TOO_MANY_LINES,
  UNSUPPORTED_FILE,
  XLSX_SIGNATURE,
} from './constants'
import { readExcel } from './readers/excel-reader'
import { readImage, readPdf } from './readers/gemini-reader'
import { matchKey, normalizeName, stripSupplierTags, suggestedName } from './normalize'
import type {
  Catalog,
  CatalogProduct,
  DetectedFile,
  Match,
  PreviewLine,
  RawReceiptLine,
  ReceiptActor,
  ReceiptPreview,
  ReceiptReaders,
  ReceiptSource,
  RowCheck,
} from './types'

// Vista previa de una remisión (spec M9-t41 §3): lee el archivo y propone renglones. No escribe nada:
// ni remisión, ni alias, ni movimientos. Los lectores de PDF e imagen llegan por `deps` para que las
// pruebas usen unos falsos; por omisión se usan los reales.
export async function previewReceipt(
  file: File,
  actor: ReceiptActor,
  deps: Partial<ReceiptReaders> = {},
): Promise<ReceiptPreview> {
  requireAdmin(actor)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const detected = detectFile(bytes)
  if (!detected) throw validation(UNSUPPORTED_FILE)
  if (bytes.byteLength > MAX_FILE_BYTES) throw validation(FILE_TOO_LARGE)

  let rows: RawReceiptLine[]
  if (detected.source === 'excel') {
    rows = await readExcel(bytes)
  } else if (detected.source === 'pdf') {
    // Un PDF de más de 20 páginas no se manda a la API: se corta antes y no cuesta nada.
    assertPdfPages(bytes)
    rows = await (deps.readPdf ?? readPdf)(bytes)
  } else {
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw validation(IMAGE_TOO_LARGE)
    rows = await (deps.readImage ?? readImage)(bytes, detected.mediaType)
  }
  return buildPreview(detected.source, rows)
}

// El tipo sale de los primeros bytes, no de la extensión: un archivo renombrado sigue siendo lo que es.
function detectFile(bytes: Uint8Array): DetectedFile | null {
  if (startsWith(bytes, PDF_SIGNATURE)) return { source: 'pdf' }
  if (startsWith(bytes, XLSX_SIGNATURE)) return { source: 'excel' }
  if (startsWith(bytes, JPEG_SIGNATURE)) return { source: 'image', mediaType: 'image/jpeg' }
  if (startsWith(bytes, PNG_SIGNATURE)) return { source: 'image', mediaType: 'image/png' }
  return null
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte)
}

// Cuenta las páginas con la marca /Type /Page sobre los bytes (heurística, sin parsear el PDF).
function assertPdfPages(bytes: Uint8Array): void {
  const text = new TextDecoder('latin1').decode(bytes)
  const pages = text.match(PDF_PAGE_MARK)?.length ?? 0
  if (pages > MAX_PDF_PAGES) throw validation(PDF_TOO_MANY_PAGES)
}

// Valida cada renglón, lo empareja con el catálogo y arma las listas de la pantalla.
async function buildPreview(source: ReceiptSource, rows: RawReceiptLine[]): Promise<ReceiptPreview> {
  const catalog = await loadCatalog(rows)
  const lines: PreviewLine[] = []
  const skipped: ReceiptPreview['skipped'] = []
  const stock = new Map<number, { productId: number; before: number; after: number }>()

  for (const row of rows) {
    // Totales y envío se ignoran sin motivo también cuando los devuelve Gemini (no solo en el Excel).
    if (isIgnoredRow(row)) continue
    const check = checkRow(row)
    if (!check.ok) {
      skipped.push(toSkipped(row.position, (row.name ?? '').trim(), check.reason))
      continue
    }

    const match = findMatch(matchKey(check.readName), catalog)
    if (match === 'inactive') {
      skipped.push(toSkipped(row.position, check.readName, 'inactive_product'))
      continue
    }

    const product = match.product
    const ref = product
      ? { id: product.id, name: product.name, image: product.image || null, unitCost: product.unitCost }
      : null
    lines.push({
      position: row.position,
      readName: check.readName,
      suggestedName: suggestedName(check.readName),
      qty: check.qty,
      unitCost: check.unitCost,
      match: match.kind,
      product: ref,
      costChanged: ref !== null && check.unitCost !== null && compareMoney(check.unitCost, 4, ref.unitCost, 4) !== 0,
    })

    // Bodega antes → después: suma las piezas de todos los renglones de cada producto.
    if (product) {
      const entry = stock.get(product.id) ?? { productId: product.id, before: product.stock, after: product.stock }
      entry.after += check.qty
      stock.set(product.id, entry)
    }
  }

  if (lines.length + skipped.length > MAX_LINES) throw validation(TOO_MANY_LINES)
  return { source, lines, skipped, stock: [...stock.values()] }
}

// Filas de total, subtotal, IVA, descuento y envío: no son productos y no van ni a lines ni a skipped.
function isIgnoredRow(row: RawReceiptLine): boolean {
  const ignored: readonly string[] = IGNORED_ROW_NAMES
  return ignored.includes(normalizeName(row.name ?? ''))
}

// Valida un renglón en el orden de la spec: nombre, piezas y costo. El emparejamiento viene después.
function checkRow(row: RawReceiptLine): RowCheck {
  const readName = (row.name ?? '').trim()
  if (stripSupplierTags(readName) === '') return { ok: false, reason: 'missing_name' }

  const qty = parseQty(row.qty)
  if (qty === null) return { ok: false, reason: 'invalid_qty' }

  const cost = parseCost(row.unitCost)
  if (cost === null) return { ok: false, reason: 'invalid_cost' }

  return { ok: true, readName, qty, unitCost: cost.value }
}

// Piezas: un entero, o un texto solo con dígitos, de 1 a MAX_QTY. Cero o vacío no es un error de
// formato: es un producto listado que no se surtió, y se reporta como renglón no leído.
function parseQty(value: unknown): number | null {
  const qty = typeof value === 'number'
    ? value
    : typeof value === 'string' && DIGITS_ONLY.test(value) ? Number(value) : null
  if (qty === null || !Number.isSafeInteger(qty)) return null
  return qty >= 1 && qty <= MAX_QTY ? qty : null
}

// Costo: se quitan $, espacios y comas de miles. Hasta 4 decimales, entre 0 y 999999.9999, y nunca
// se redondea (spec §3). Vacío da null: el renglón se lee sin costo. Devuelve null si no es válido.
function parseCost(value: unknown): { value: string | null } | null {
  if (value === null || value === undefined) return { value: null }
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value).trim()
  if (text === '') return { value: null }

  const cleaned = text.replace(/[$,\s]/g, '')
  const places = decimalPlaces(cleaned)
  if (places === null || places > 4) return null
  if (compareMoney(cleaned, 4, MONEY_MAX[4], 4) > 0) return null
  return { value: cleaned }
}

// Carga lo que hace falta para emparejar: el catálogo completo (con inactivos) y los alias de las llaves
// de esta remisión. Un nombre que son solo etiquetas no tiene llave y no se busca.
async function loadCatalog(rows: RawReceiptLine[]): Promise<Catalog> {
  const keys = [...new Set(rows.map((row) => matchKey(row.name ?? '')).filter((key) => key !== ''))]
  const catalogRows = await productsForMatching()
  const aliasRows = keys.length === 0
    ? []
    : await db.select().from(supplierProductAliases).where(inArray(supplierProductAliases.normalizedName, keys))

  const byId = new Map<number, CatalogProduct>()
  const byName = new Map<string, CatalogProduct[]>()
  for (const product of catalogRows) {
    byId.set(product.id, product)
    const key = normalizeName(product.name)
    byName.set(key, [...(byName.get(key) ?? []), product])
  }
  const aliases = new Map<string, number>(aliasRows.map((alias) => [alias.normalizedName, alias.productId] as const))
  return { byId, byName, aliases }
}

// Orden de la spec: 1) alias activo, 2) nombre con exactamente un producto activo, 3) sin pareja.
// Solo un producto desactivado con ese nombre da 'inactive': el renglón va a skipped, no a la lista.
function findMatch(key: string, catalog: Catalog): Match | 'inactive' {
  const aliasedId = catalog.aliases.get(key)
  const aliased = aliasedId === undefined ? undefined : catalog.byId.get(aliasedId)
  // Un alias hacia un producto desactivado se ignora y se sigue con el nombre.
  if (aliased?.active) return { kind: 'alias', product: aliased }

  const sameName = catalog.byName.get(key) ?? []
  const active = sameName.filter((product) => product.active)
  if (active.length === 1) return { kind: 'name', product: active[0]! }
  if (active.length === 0 && sameName.length > 0) return 'inactive'
  return { kind: 'none', product: null }
}

function toSkipped(position: number, text: string, reason: ReceiptPreview['skipped'][number]['reason']): ReceiptPreview['skipped'][number] {
  return { position, text, reason, label: SKIP_LABELS[reason] }
}
