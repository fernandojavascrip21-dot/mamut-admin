import { and, desc, eq } from 'drizzle-orm'
import { getActiveSellerName } from '@accounts'
import { db } from '@db/client'
import { products, profiles, stockMovements } from '@db/schema'
import { forbidden } from '@lib/errors'
import { SHRINKAGE_REASONS } from './constants'
import type { ShrinkageActor, ShrinkageHistoryFilter, ShrinkageHistoryItem, ShrinkageReason } from './types'

const isReason = (value: string): value is ShrinkageReason => Object.hasOwn(SHRINKAGE_REASONS, value)

// Historial de mermas (HU-26): solo lee. Las filas anteriores a T-25 no tienen motivo, así que la
// pantalla pinta «Sin motivo» con reason y reasonLabel en null. Un vendedor ya desactivado sigue
// apareciendo como titular: la merma hecha no debe desaparecer por eso. Con scope `seller` el
// vendedor debe estar activo (404); el orden es de la más nueva a la más vieja.
export async function listShrinkages(
  filter: ShrinkageHistoryFilter,
  actor: ShrinkageActor,
): Promise<ShrinkageHistoryItem[]> {
  if (actor.role !== 'admin') throw forbidden()
  if (filter.scope === 'seller') await getActiveSellerName(filter.sellerId)

  const rows = await db
    .select({
      requestId: stockMovements.requestId,
      createdAt: stockMovements.createdAt,
      qty: stockMovements.qty,
      reason: stockMovements.reason,
      holderId: profiles.id,
      holderName: profiles.fullName,
      holderProfileId: stockMovements.holderProfileId,
      productId: products.id,
      productName: products.name,
      productImage: products.image,
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .leftJoin(profiles, eq(profiles.id, stockMovements.holderProfileId))
    .where(and(
      eq(stockMovements.type, 'shrinkage'),
      filter.scope === 'seller' ? eq(stockMovements.holderProfileId, filter.sellerId) : undefined,
    ))
    .orderBy(desc(stockMovements.id))
    .limit(filter.limit)

  return rows.map((row) => {
    const reason = row.reason !== null && isReason(row.reason) ? row.reason : null
    return {
      requestId: row.requestId,
      createdAt: row.createdAt,
      qty: -row.qty,
      reason,
      reasonLabel: reason === null ? null : SHRINKAGE_REASONS[reason],
      holder: row.holderProfileId === null || row.holderId === null || row.holderName === null
        ? null
        : { id: row.holderId, fullName: row.holderName },
      product: { id: row.productId, name: row.productName, image: row.productImage || null },
    }
  })
}
