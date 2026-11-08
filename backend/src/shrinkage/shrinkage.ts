import { sql } from 'drizzle-orm'
import { getActiveSellerName, getSellerName } from '@accounts'
import { isUniqueViolation } from '@db/errors'
import { withTransaction } from '@db/transaction'
import { findProduct } from '@products'
import { insertMovements, movementOfShrinkage, type ShrinkageMovement } from '@stock'
import { conflict, forbidden, notFound, validation } from '@lib/errors'
import { INVALID_REASON, MAX_QTY, SHRINKAGE_MISMATCH, SHRINKAGE_REASONS } from './constants'
import type { CreateShrinkageInput, Shrinkage, ShrinkageActor, ShrinkageOptions, ShrinkageReason } from './types'

const isReason = (value: string): value is ShrinkageReason => Object.hasOwn(SHRINKAGE_REASONS, value)

// Solo el administrador registra o relee mermas (spec T-25 §3).
function requireAdmin(actor: ShrinkageActor): void {
  if (actor.role !== 'admin') throw forbidden()
}

// Arma la respuesta de una merma ya registrada. El nombre del vendedor se lee aunque luego se haya
// desactivado: la merma ya hecha no desaparece por eso.
async function toShrinkage(moved: ShrinkageMovement): Promise<Shrinkage> {
  const [holder, product] = await Promise.all([
    moved.holderProfileId === null ? Promise.resolve(null) : getSellerName(moved.holderProfileId),
    findProduct(moved.productId),
  ])
  const reason = moved.reason !== null && isReason(moved.reason) ? moved.reason : 'other'
  return {
    requestId: moved.requestId,
    createdAt: moved.createdAt,
    qty: moved.qty,
    reason,
    reasonLabel: SHRINKAGE_REASONS[reason],
    holder,
    product: { id: product.id, name: product.name, image: product.image || null },
    stock: moved.stock,
  }
}

// ¿La merma guardada es la misma petición? Titular, producto, piezas y motivo deben coincidir.
const sameRequest = (moved: ShrinkageMovement, input: CreateShrinkageInput) =>
  moved.holderProfileId === input.holderProfileId
  && moved.productId === input.productId
  && moved.qty === input.qty
  && moved.reason === input.reason

// Si el requestId ya es de una merma: con los mismos datos la devuelve, con otros lanza 409.
async function findReplay(input: CreateShrinkageInput): Promise<ShrinkageMovement | null> {
  const moved = await movementOfShrinkage(input.requestId)
  if (!moved) return null
  if (!sameRequest(moved, input)) throw conflict(SHRINKAGE_MISMATCH)
  return moved
}

// Dar de baja piezas de un vendedor activo o de la bodega (T-25): una sola fila `shrinkage` con el
// motivo y el requestId. Nunca escribe saldos: el trigger de T-07 los ajusta y rechaza dejar al
// titular en negativo (409). El requestId la hace idempotente. El índice único de HU-11 es por
// (request_id, titular) y no ve el mismo requestId con otro titular, así que dentro de la
// transacción se toma un candado por requestId y se vuelve a buscar antes de insertar.
export async function createShrinkage(
  input: CreateShrinkageInput,
  actor: ShrinkageActor,
): Promise<{ shrinkage: Shrinkage; replayed: boolean }> {
  requireAdmin(actor)
  if (!Number.isSafeInteger(input.qty) || input.qty <= 0) throw validation('El campo qty debe ser un entero mayor a 0')
  if (input.qty > MAX_QTY) throw validation('El campo qty es demasiado grande')
  if (!isReason(input.reason)) throw validation(INVALID_REASON)

  const replay = await findReplay(input)
  if (replay) return { shrinkage: await toShrinkage(replay), replayed: true }

  if (input.holderProfileId !== null) await getActiveSellerName(input.holderProfileId)
  await findProduct(input.productId) // también desactivado: sus piezas siguen existiendo

  let replayed = false
  try {
    replayed = await withTransaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.requestId}))`)
      if (await findReplay(input)) return true
      await insertMovements(tx, [{
        productId: input.productId,
        type: 'shrinkage',
        qty: -input.qty,
        holderProfileId: input.holderProfileId,
        createdBy: actor.userId,
        reason: input.reason,
        requestId: input.requestId,
      }])
      return false
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      const raced = await findReplay(input)
      if (raced) return { shrinkage: await toShrinkage(raced), replayed: true }
      throw conflict(SHRINKAGE_MISMATCH)
    }
    throw err
  }

  const moved = await movementOfShrinkage(input.requestId)
  if (!moved) throw new Error('La merma no quedó registrada')
  return { shrinkage: await toShrinkage(moved), replayed }
}

// Merma por su requestId; sobrevive a una recarga. 404 si no existe o el requestId es de otro tipo.
export async function getShrinkage(requestId: string, actor: ShrinkageActor): Promise<Shrinkage> {
  requireAdmin(actor)
  const moved = await movementOfShrinkage(requestId)
  if (!moved) throw notFound()
  return toShrinkage(moved)
}

// Esqueleto (HU-25): opciones del pop-up «Registrar merma». Sin implementar.
export async function listShrinkageOptions(sellerId: string | null, actor: ShrinkageActor): Promise<ShrinkageOptions> {
  void sellerId
  void actor
  throw new Error('listShrinkageOptions no está implementado')
}
