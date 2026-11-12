import type { products } from '@db/schema'

export type ReceiptSource = 'excel' | 'pdf' | 'image'
export type ReceiptImageType = 'image/jpeg' | 'image/png'
export type MatchKind = 'alias' | 'name' | 'none'
export type SkipReason = 'missing_name' | 'invalid_qty' | 'invalid_cost' | 'inactive_product'
export type ReceiptLineStatus = 'received' | 'pending' | 'created' | 'discarded'
export type CostStatus = 'pending' | 'accepted' | 'rejected'

// Quien registra, consulta o resuelve una remisión; solo el administrador puede.
export interface ReceiptActor {
  userId: string
  role: string
}

// Lo que devuelve un lector (Excel, PDF o imagen) antes de validar: textos crudos.
export interface RawReceiptLine {
  position: number
  name: string | null
  qty: unknown
  unitCost: unknown
}
export type PdfReader = (bytes: Uint8Array) => Promise<RawReceiptLine[]>
export type ImageReader = (bytes: Uint8Array, mediaType: ReceiptImageType) => Promise<RawReceiptLine[]>

// Producto del catálogo que un renglón emparejó (o null si no hay pareja).
export interface ReceiptProductRef {
  id: number
  name: string
  image: string | null
}

// Renglón propuesto por la vista previa. `unitCost` es el texto leído; `product` trae el costo
// actual para que la pantalla compare sin repetir la regla.
export interface PreviewLine {
  position: number
  readName: string
  suggestedName: string
  qty: number
  unitCost: string | null
  match: MatchKind
  product: (ReceiptProductRef & { unitCost: string }) | null
  costChanged: boolean
}

export interface ReceiptPreview {
  source: ReceiptSource
  lines: PreviewLine[]
  skipped: { position: number; text: string; reason: SkipReason; label: string }[]
  stock: { productId: number; before: number; after: number }[]
}

// Renglón final que envía la pantalla; HU-42 puede haber cambiado producto o piezas.
export interface ConfirmReceiptLineInput {
  readName: string
  qty: number
  unitCost: string | null
  productId: number | null
}

export interface ConfirmReceiptInput {
  requestId: string
  source: ReceiptSource
  fileName: string | null
  lines: ConfirmReceiptLineInput[]
}

export interface ReceiptLine {
  id: number
  position: number
  readName: string
  qty: number
  unitCost: string | null
  status: ReceiptLineStatus
  costStatus: CostStatus | null
  product: ReceiptProductRef | null
}

export interface Receipt {
  requestId: string
  source: ReceiptSource
  fileName: string | null
  createdAt: string
  lines: ReceiptLine[]
  // Stock de bodega leído después del commit, por cada producto que tocó la remisión.
  units: { productId: number; units: number }[]
}

export interface PendingNewProduct {
  lineId: number
  receipt: { requestId: string; createdAt: string }
  suggestedName: string
  qty: number
  unitCost: string | null
}

export interface PendingCostChange {
  lineId: number
  receipt: { requestId: string; createdAt: string }
  product: { id: number; name: string; image: string | null; active: boolean }
  qty: number
  currentUnitCost: string
  previousUnitCost: string
  newUnitCost: string
}

// Las dos listas van juntas; el filtro entre ellas es de HU-42.
export interface PendingReceiptLines {
  newProducts: PendingNewProduct[]
  costChanges: PendingCostChange[]
}

// Lectores de PDF e imagen que recibe la vista previa; las pruebas pasan unos falsos (spec §3).
export interface ReceiptReaders {
  readPdf: PdfReader
  readImage: ImageReader
}

// Tipo de archivo decidido por sus primeros bytes.
export type DetectedFile =
  | { source: 'excel' }
  | { source: 'pdf' }
  | { source: 'image'; mediaType: ReceiptImageType }

// Resultado de validar un renglón leído: o un motivo de salto, o los datos ya limpios.
export type RowCheck =
  | { ok: true; readName: string; qty: number; unitCost: string | null }
  | { ok: false; reason: SkipReason }

// Producto del catálogo para emparejar: incluye inactivos, para avisar y no ignorar.
export interface CatalogProduct {
  id: number
  name: string
  image: string
  unitCost: string
  stock: number
  active: boolean
}

// Catálogo y alias ya cargados para una vista previa: búsquedas por id, por nombre normalizado y por llave.
export interface Catalog {
  byId: Map<number, CatalogProduct>
  byName: Map<string, CatalogProduct[]>
  aliases: Map<string, number>
}

// Resultado de emparejar un renglón: alias o nombre, o sin pareja.
export interface Match {
  kind: MatchKind
  product: CatalogProduct | null
}

// Alta de un producto nuevo desde un pendiente (spec §3, «Dar de alta»). `unitCost` es opcional.
export interface CreateProductFromLineInput {
  name: string
  price: string
  categoryId: number | null
  unitCost?: string
}

export type ReceiptProductRow = typeof products.$inferSelect

// Columnas de la remisión que se leen del Excel: producto y piezas son obligatorias; el costo es opcional.
export interface HeaderColumns {
  row: number
  product: number
  qty: number
  cost: number | null
}

export interface CreateProductFromLineResult {
  product: ReceiptProductRow
  line: ReceiptLine
  stock: { before: number; after: number }
}

export interface AcceptLineCostResult {
  line: ReceiptLine
  product: { id: number; unitCost: string }
}
