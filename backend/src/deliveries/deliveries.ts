import { getActiveSellerName, getSellerName } from '@accounts'
import { isUniqueViolation } from '@db/errors'
import { withTransaction } from '@db/transaction'
import { findProduct, getProduct } from '@products'
import {
  holdingOf, insertMovements, listDeliveries, movementsOfRequest, setHolderPrices,
  type DeliveryRow, type HolderHolding, type RequestMovements,
} from '@stock'
import { conflict, notFound, validation } from '@lib/errors'
import { DELIVERY_MISMATCH, HISTORY_LIMIT, MAX_QTY } from './constants'

export interface CreateDeliveryInput {
  requestId: string
  sellerId: string
  productId: number
  qty: number
  unitPrice: string | null            // null = usar el precio general (RF-26)
  unitCostWithShipping: string | null // null = usar el costo de fábrica (RF-27)
}

// Lo que ven la ventana y el resumen. `price` y `unitCost` son los generales del producto;
// `unitPrice` y `unitCostWithShipping`, los propios del vendedor. Solo para administradores (RNF-04).
export interface Delivery {
  requestId: string
  createdAt: string
  qty: number
  seller: { id: string; fullName: string }
  product: { id: number; name: string; image: string | null; price: string; unitCost: string }
  unitPrice: string | null
  unitCostWithShipping: string | null
  warehouse: { before: number; after: number }
  sellerStock: { before: number; after: number }
}

// Arma la respuesta de una entrega ya registrada. Los saldos salen de los movimientos (no de la
// caché actual) y los precios son los vigentes del vendedor.
async function toDelivery(moved: RequestMovements): Promise<Delivery> {
  const [seller, product, holding] = await Promise.all([
    getSellerName(moved.sellerId),
    findProduct(moved.productId),
    holdingOf(moved.sellerId, moved.productId),
  ])
  return {
    requestId: moved.requestId,
    createdAt: moved.createdAt,
    qty: moved.qty,
    seller,
    product: {
      id: product.id, name: product.name, image: product.image || null,
      price: product.price, unitCost: product.unitCost,
    },
    unitPrice: holding.unitPrice,
    unitCostWithShipping: holding.unitCostWithShipping,
    warehouse: moved.warehouse,
    sellerStock: moved.sellerStock,
  }
}

// Si el requestId ya existe: con los mismos datos devuelve esa entrega, con otros lanza 409.
async function findReplay(input: CreateDeliveryInput): Promise<Delivery | null> {
  const moved = await movementsOfRequest(input.requestId)
  if (!moved) return null
  if (moved.sellerId !== input.sellerId || moved.productId !== input.productId || moved.qty !== input.qty) {
    throw conflict(DELIVERY_MISMATCH)
  }
  return toDelivery(moved)
}

// Dejarle producto a un vendedor (HU-11): dos movimientos `delivery` (bodega −N, vendedor +N) y sus
// precios propios, en una sola transacción. Nunca escribe qty: eso es del trigger de T-07.
// El requestId hace la operación idempotente: repetirla con los mismos datos responde la entrega ya
// hecha sin mover nada (replayed: true), y si dos peticiones iguales llegan a la vez, el índice único
// deja pasar una y la otra cae en esa misma respuesta.
export async function createDelivery(
  input: CreateDeliveryInput,
  createdBy: string,
): Promise<{ delivery: Delivery; replayed: boolean }> {
  if (!Number.isSafeInteger(input.qty) || input.qty <= 0) throw validation('El campo qty debe ser un entero mayor a 0')
  if (input.qty > MAX_QTY) throw validation('El campo qty es demasiado grande')

  const replay = await findReplay(input)
  if (replay) return { delivery: replay, replayed: true }

  await getActiveSellerName(input.sellerId)
  await getProduct(input.productId)

  try {
    await withTransaction(async (tx) => {
      await insertMovements(tx, [
        { productId: input.productId, type: 'delivery', qty: -input.qty, holderProfileId: null, createdBy, requestId: input.requestId },
        { productId: input.productId, type: 'delivery', qty: input.qty, holderProfileId: input.sellerId, createdBy, requestId: input.requestId },
      ])
      await setHolderPrices(tx, input.sellerId, input.productId, {
        unitPrice: input.unitPrice,
        unitCostWithShipping: input.unitCostWithShipping,
      })
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      const raced = await findReplay(input)
      if (raced) return { delivery: raced, replayed: true }
    }
    throw err
  }

  const moved = await movementsOfRequest(input.requestId)
  if (!moved) throw new Error('La entrega no quedó registrada')
  return { delivery: await toDelivery(moved), replayed: false }
}

// Resumen de una entrega por su requestId; sobrevive a una recarga de la pantalla.
export async function getDelivery(requestId: string): Promise<Delivery> {
  const moved = await movementsOfRequest(requestId)
  if (!moved) throw notFound()
  return toDelivery(moved)
}

// «Últimas entregas» del detalle de un vendedor activo.
export async function listSellerDeliveries(sellerId: string): Promise<DeliveryRow[]> {
  await getActiveSellerName(sellerId)
  return listDeliveries(sellerId, HISTORY_LIMIT)
}

// Lo que el vendedor ya tiene de un producto, para prellenar la ventana. El producto puede estar
// archivado (sus piezas siguen con el vendedor); solo 404 si no existe.
export async function getSellerHolding(sellerId: string, productId: number): Promise<HolderHolding> {
  await getActiveSellerName(sellerId)
  await findProduct(productId)
  return holdingOf(sellerId, productId)
}
