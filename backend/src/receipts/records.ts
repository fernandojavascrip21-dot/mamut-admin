import { asc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@db/client'
import { products, supplierProductAliases, supplierReceiptLines, supplierReceipts } from '@db/schema'
import type { Tx } from '@db/transaction'
import { matchKey } from './normalize'
import type {
  CostStatus,
  Receipt,
  ReceiptLine,
  ReceiptLineStatus,
  ReceiptProductRef,
  ReceiptSource,
} from './types'

// Fila de un renglón tal como está en la base.
export type ReceiptLineRow = typeof supplierReceiptLines.$inferSelect

// Un producto en una remisión: id, nombre y foto (vacía = null, como en las entradas de HU-27).
export function toProductRef(product: { id: number; name: string; image: string }): ReceiptProductRef {
  return { id: product.id, name: product.name, image: product.image || null }
}

// Forma de un renglón para la pantalla. Los estados los escribe el caso de uso; aquí solo se traducen.
export function toReceiptLine(row: ReceiptLineRow, product: ReceiptProductRef | null): ReceiptLine {
  return {
    id: row.id,
    position: row.position,
    readName: row.readName,
    qty: row.qty,
    unitCost: row.unitCost,
    status: row.status as ReceiptLineStatus,
    costStatus: row.costStatus as CostStatus | null,
    product,
  }
}

// Guarda cómo se llama el renglón en el proveedor → producto. Si el administrador cambió el
// emparejamiento, gana el último (spec §3). Un nombre que son solo etiquetas no tiene llave: no se guarda.
export async function upsertAlias(tx: Tx, readName: string, productId: number, userId: string): Promise<void> {
  const key = matchKey(readName)
  if (key === '') return
  await tx.insert(supplierProductAliases)
    .values({ normalizedName: key, productId, updatedBy: userId })
    .onConflictDoUpdate({
      target: supplierProductAliases.normalizedName,
      set: { productId, updatedBy: userId, updatedAt: sql`now()` },
    })
}

// Lee una remisión con sus renglones y el stock de bodega de los productos que toca. Se llama después
// del commit, así que el stock es el que quedó tras la entrada.
export async function loadReceipt(requestId: string): Promise<Receipt | null> {
  const [receipt] = await db.select().from(supplierReceipts).where(eq(supplierReceipts.requestId, requestId))
  if (!receipt) return null

  const rows = await db.select().from(supplierReceiptLines)
    .where(eq(supplierReceiptLines.receiptId, receipt.id))
    .orderBy(asc(supplierReceiptLines.position))

  const productIds = [...new Set(rows.flatMap((row) => (row.productId === null ? [] : [row.productId])))]
  const productRows = productIds.length === 0
    ? []
    : await db.select({ id: products.id, name: products.name, image: products.image, stock: products.stock })
      .from(products)
      .where(inArray(products.id, productIds))
  const byId = new Map<number, (typeof productRows)[number]>(productRows.map((product) => [product.id, product] as const))

  return {
    requestId: receipt.requestId,
    source: receipt.source as ReceiptSource,
    fileName: receipt.fileName,
    createdAt: receipt.createdAt,
    lines: rows.map((row) => {
      const product = row.productId === null ? undefined : byId.get(row.productId)
      return toReceiptLine(row, product ? toProductRef(product) : null)
    }),
    units: productRows.map((product) => ({ productId: product.id, units: product.stock })),
  }
}
