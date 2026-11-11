import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { db, sql } from '@db/client'
import { products, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { createProduct } from '@products'
import { insertMovements } from '@stock'

// Todo lo que crean las pruebas de resurtir lleva este prefijo para poder limpiarlo.
export const RESTOCK_PREFIX = 'test-rst-'

export const restockProductName = (label: string) =>
  `${RESTOCK_PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// Crea un producto de prueba. Con 0 piezas no se puede crear (initial > 0): se crea con 1 y se da de
// baja con una merma.
export async function createRestockProduct(
  adminId: string,
  opts: { qty?: number; unitCost?: string; label?: string } = {},
): Promise<number> {
  const qty = opts.qty ?? 5
  const created = await createProduct({
    name: restockProductName(opts.label ?? 'prod'), categoryId: null, price: '900.00',
    unitCost: opts.unitCost ?? '450.0000', initialQty: qty === 0 ? 1 : qty,
    fractionable: false, portionSize: null, image: null,
  }, adminId)
  if (qty === 0) {
    await withTransaction((tx) => insertMovements(tx, [{
      productId: created.id as number, type: 'shrinkage', qty: -1, holderProfileId: null, createdBy: adminId,
    }]))
  }
  return created.id as number
}

// Primero los pedidos de prueba (los renglones se van por cascada), luego movimientos del más nuevo
// al más viejo (revierten saldos), existencias de vendedor, bolsitas y productos.
export async function cleanupRestockData(adminId: string | undefined) {
  if (adminId) await sql`delete from restock_orders where created_by = ${adminId}`
  const rows = await db.select({ id: products.id }).from(products).where(ilike(products.name, `${RESTOCK_PREFIX}%`))
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return
  const movements = await db.select({ id: stockMovements.id }).from(stockMovements)
    .where(inArray(stockMovements.productId, ids)).orderBy(desc(stockMovements.id))
  for (const movement of movements) {
    await db.delete(stockMovements).where(eq(stockMovements.id, movement.id))
  }
  await db.delete(vendorStock).where(inArray(vendorStock.productId, ids))
  await sql`delete from fractions where product_id = any(${ids}) or portion_product_id = any(${ids})`
  const portions = await db.select({ id: products.id }).from(products).where(inArray(products.parentProductId, ids))
  if (portions.length > 0) await db.delete(products).where(inArray(products.id, portions.map((p) => p.id)))
  await db.delete(products).where(inArray(products.id, ids))
}
