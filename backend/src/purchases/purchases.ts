import { sql } from 'drizzle-orm'
import { isUniqueViolation } from '@db/errors'
import { withTransaction } from '@db/transaction'
import { findProduct } from '@products'
import { insertMovements, movementOfPurchase, type PurchaseMovement } from '@stock'
import { conflict, forbidden, notFound, validation } from '@lib/errors'
import { MAX_QTY, PRODUCT_INACTIVE, PURCHASE_MISMATCH } from './constants'
import type { CreatePurchaseInput, Purchase, PurchaseActor } from './types'

// Solo el administrador registra o relee entradas (HU-27, criterio 5).
function requireAdmin(actor: PurchaseActor): void {
  if (actor.role !== 'admin') throw forbidden()
}

// Arma la respuesta de una entrada ya registrada. Lee el producto aunque luego se desactive: la
// entrada hecha no desaparece por eso.
async function toPurchase(moved: PurchaseMovement): Promise<Purchase> {
  const product = await findProduct(moved.productId)
  return {
    requestId: moved.requestId,
    createdAt: moved.createdAt,
    qty: moved.qty,
    product: { id: product.id, name: product.name, image: product.image || null },
    stock: moved.stock,
  }
}

// ¿La entrada guardada es la misma petición? Producto y piezas deben coincidir.
const sameRequest = (moved: PurchaseMovement, input: CreatePurchaseInput) =>
  moved.productId === input.productId && moved.qty === input.qty

// Si el requestId ya es de una entrada: con los mismos datos la devuelve, con otros lanza 409.
async function findReplay(input: CreatePurchaseInput): Promise<PurchaseMovement | null> {
  const moved = await movementOfPurchase(input.requestId)
  if (!moved) return null
  if (!sameRequest(moved, input)) throw conflict(PURCHASE_MISMATCH)
  return moved
}

// Entrada de piezas a la bodega de un producto que ya existe (HU-27): una sola fila `purchase`
// (bodega, qty > 0) con el requestId. Nunca escribe saldos: el trigger de T-07 los ajusta. El
// requestId la hace idempotente; dentro de la transacción se toma un candado por requestId y se
// vuelve a buscar antes de insertar, para que dos peticiones simultáneas dejen una sola entrada.
// Los productos desactivados no reciben entradas; las bolsitas sí.
export async function createPurchase(
  input: CreatePurchaseInput,
  actor: PurchaseActor,
): Promise<{ purchase: Purchase; replayed: boolean }> {
  requireAdmin(actor)
  if (!Number.isSafeInteger(input.qty) || input.qty <= 0) throw validation('El campo qty debe ser un entero mayor a 0')
  if (input.qty > MAX_QTY) throw validation('El campo qty es demasiado grande')

  const replay = await findReplay(input)
  if (replay) return { purchase: await toPurchase(replay), replayed: true }

  const product = await findProduct(input.productId)
  if (!product.active) throw conflict(PRODUCT_INACTIVE)

  let replayed = false
  try {
    replayed = await withTransaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.requestId}))`)
      if (await findReplay(input)) return true
      await insertMovements(tx, [{
        productId: input.productId,
        type: 'purchase',
        qty: input.qty,
        holderProfileId: null,
        createdBy: actor.userId,
        requestId: input.requestId,
      }])
      return false
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      const raced = await findReplay(input)
      if (raced) return { purchase: await toPurchase(raced), replayed: true }
      throw conflict(PURCHASE_MISMATCH)
    }
    throw err
  }

  const moved = await movementOfPurchase(input.requestId)
  if (!moved) throw new Error('La entrada no quedó registrada')
  return { purchase: await toPurchase(moved), replayed }
}

// Entrada por su requestId; sobrevive a una recarga. 404 si no existe o el requestId es de otro tipo.
export async function getPurchase(requestId: string, actor: PurchaseActor): Promise<Purchase> {
  requireAdmin(actor)
  const moved = await movementOfPurchase(requestId)
  if (!moved) throw notFound()
  return toPurchase(moved)
}
