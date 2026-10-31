import { getActiveSellerName, getSellerName } from '@accounts'
import { isUniqueViolation } from '@db/errors'
import { withTransaction } from '@db/transaction'
import { findProduct } from '@products'
import { insertMovements, listReturns, movementsOfRequest, type RequestMovements, type ReturnRow } from '@stock'
import { conflict, notFound, validation } from '@lib/errors'
import { HISTORY_LIMIT, MAX_QTY, RETURN_MISMATCH } from './constants'

export interface CreateReturnInput {
  requestId: string
  sellerId: string
  productId: number
  qty: number
}

// Lo que ven la pantalla y el resumen. `qty` va en positivo: son las piezas que regresaron a la
// bodega. No lleva precios ni costos: un retiro no los usa ni los cambia.
export interface SellerReturn {
  requestId: string
  createdAt: string
  qty: number
  seller: { id: string; fullName: string }
  product: { id: number; name: string; image: string | null }
  sellerStock: { before: number; after: number }
  warehouse: { before: number; after: number }
}

// Arma la respuesta de un retiro ya registrado. Los saldos salen de los movimientos, no de la
// caché actual, para que consultarlo después dé lo mismo que la primera vez.
async function toReturn(moved: RequestMovements): Promise<SellerReturn> {
  const [seller, product] = await Promise.all([getSellerName(moved.sellerId), findProduct(moved.productId)])
  return {
    requestId: moved.requestId,
    createdAt: moved.createdAt,
    qty: moved.qty,
    seller,
    product: { id: product.id, name: product.name, image: product.image || null },
    sellerStock: moved.sellerStock,
    warehouse: moved.warehouse,
  }
}

// Si el requestId ya es de un retiro: con los mismos datos devuelve ese retiro, con otros lanza 409.
async function findReplay(input: CreateReturnInput): Promise<SellerReturn | null> {
  const moved = await movementsOfRequest(input.requestId, 'return')
  if (!moved) return null
  if (moved.sellerId !== input.sellerId || moved.productId !== input.productId || moved.qty !== input.qty) {
    throw conflict(RETURN_MISMATCH)
  }
  return toReturn(moved)
}

// Retirarle piezas a un vendedor (HU-12): dos movimientos `return` (vendedor −N, bodega +N) en una
// sola transacción. Nunca escribe qty: eso es del trigger de T-07, que además rechaza dejar al
// vendedor en negativo (409), con un producto que nunca tuvo incluido, sin dejar fila en vendor_stock.
// El requestId lo hace idempotente: repetirlo con los mismos datos responde el retiro ya hecho
// (replayed: true). Si dos peticiones iguales llegan a la vez, el índice único deja pasar una y la
// otra cae en esa misma respuesta; si el requestId era de una entrega, también choca con el índice
// y responde 409.
export async function createReturn(
  input: CreateReturnInput,
  createdBy: string,
): Promise<{ sellerReturn: SellerReturn; replayed: boolean }> {
  if (!Number.isSafeInteger(input.qty) || input.qty <= 0) throw validation('El campo qty debe ser un entero mayor a 0')
  if (input.qty > MAX_QTY) throw validation('El campo qty es demasiado grande')

  const replay = await findReplay(input)
  if (replay) return { sellerReturn: replay, replayed: true }

  await getActiveSellerName(input.sellerId)
  await findProduct(input.productId) // también archivado: es la única forma de regresar esas piezas

  try {
    await withTransaction((tx) => insertMovements(tx, [
      { productId: input.productId, type: 'return', qty: -input.qty, holderProfileId: input.sellerId, createdBy, requestId: input.requestId },
      { productId: input.productId, type: 'return', qty: input.qty, holderProfileId: null, createdBy, requestId: input.requestId },
    ]))
  } catch (err) {
    if (isUniqueViolation(err)) {
      const raced = await findReplay(input)
      if (raced) return { sellerReturn: raced, replayed: true }
      throw conflict(RETURN_MISMATCH)
    }
    throw err
  }

  const moved = await movementsOfRequest(input.requestId, 'return')
  if (!moved) throw new Error('El retiro no quedó registrado')
  return { sellerReturn: await toReturn(moved), replayed: false }
}

// Resumen de un retiro por su requestId; sobrevive a una recarga. 404 si no existe, si es de otro
// vendedor o si el requestId es de una entrega. No exige que el vendedor siga activo.
export async function getReturn(sellerId: string, requestId: string): Promise<SellerReturn> {
  const moved = await movementsOfRequest(requestId, 'return')
  if (!moved || moved.sellerId !== sellerId) throw notFound()
  return toReturn(moved)
}

// «Últimos retiros» del detalle de un vendedor activo.
export async function listSellerReturns(sellerId: string): Promise<ReturnRow[]> {
  await getActiveSellerName(sellerId)
  return listReturns(sellerId, HISTORY_LIMIT)
}
