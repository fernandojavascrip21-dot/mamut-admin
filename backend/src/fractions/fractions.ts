import { asc, eq } from 'drizzle-orm'
import { db } from '@db/client'
import { isUniqueViolation, pgConstraintName } from '@db/errors'
import { fractions, products } from '@db/schema'
import { lockRows, withTransaction, type Tx } from '@db/transaction'
import { findProduct, PRICE_BELOW_COST } from '@products'
import { insertMovements } from '@stock'
import { conflict, forbidden, notFound, validation } from '@lib/errors'
import { compareMoney, divideMoney } from '@lib/money'
import {
  FRACTION_MISMATCH,
  FRACTION_REQUEST_CONSTRAINT,
  MAX_PORTIONS,
  MIN_PORTIONS,
  NOT_FRACTIONABLE,
  PORTION_COST_ZERO,
  PORTIONS_OUT_OF_RANGE,
  PRICE_REQUIRED,
  PRODUCT_NAME_CONSTRAINT,
  WHOLE_UNITS_PER_FRACTION,
} from './constants'
import type { CreateFractionInput, Fraction, FractionActor, FractionOption, FractionRow, ProductRow } from './types'

// Nombre de la bolsita: el del entero más su porción (spec T-24 §3).
const portionProductName = (wholeName: string, portionSize: string) => `${wholeName} · bolsita ${portionSize}`

// 409 cuando el nombre de la bolsita ya lo usa otro producto.
const duplicatePortionName = (name: string) => `Ya existe un producto con el nombre «${name}»`

// Arma la respuesta de un fraccionado ya guardado. Los saldos de bodega se leen al responder: en la
// primera respuesta son los de después del fraccionado; en una repetición o un GET, los actuales.
// El precio y el costo por bolsita son los del momento (las columnas de `fractions`).
async function toFraction(row: FractionRow): Promise<Fraction> {
  const whole = await findProduct(row.productId)
  const bag = await findProduct(row.portionProductId)
  // El fraccionado más antiguo de la bolsita es el que la creó.
  const [oldest] = await db
    .select({ id: fractions.id })
    .from(fractions)
    .where(eq(fractions.portionProductId, row.portionProductId))
    .orderBy(asc(fractions.id))
    .limit(1)
  return {
    id: row.id,
    requestId: row.requestId,
    portions: row.portions,
    wholeUnitCost: row.wholeUnitCost,
    portionUnitCost: row.portionUnitCost,
    createdAt: row.createdAt,
    product: { id: whole.id, name: whole.name, stock: whole.stock },
    portionProduct: {
      id: bag.id,
      name: bag.name,
      created: oldest?.id === row.id,
      price: row.portionPrice,
      stock: bag.stock,
    },
  }
}

// Si el requestId ya existe, responde ese fraccionado. Con el mismo entero y porciones, y el mismo
// precio si se mandó uno, es una repetición; con otros datos, 409. Sin `price` no hay con qué comparar
// el precio, porque la tabla guarda el precio tras el fraccionado y no el que se mandó.
async function findReplay(input: CreateFractionInput): Promise<Fraction | null> {
  const [row] = await db.select().from(fractions).where(eq(fractions.requestId, input.requestId))
  if (!row) return null
  const samePrice = input.price === null || compareMoney(input.price, 2, row.portionPrice, 2) === 0
  if (row.productId !== input.productId || row.portions !== input.portions || !samePrice) {
    throw conflict(FRACTION_MISMATCH)
  }
  return toFraction(row)
}

// Porciones fuera de 2..1000 o no enteras: 422 antes de tocar la base.
function assertPortions(portions: number): void {
  if (!Number.isInteger(portions) || portions < MIN_PORTIONS || portions > MAX_PORTIONS) {
    throw validation(PORTIONS_OUT_OF_RANGE)
  }
}

// Crea la bolsita. Si otro producto ya usa el nombre, el índice único lo rechaza: se traduce a 409
// (la transacción completa se revierte, así que no queda nada escrito).
async function insertPortionProduct(
  tx: Tx,
  whole: ProductRow,
  portionSize: string,
  portionUnitCost: string,
  price: string,
): Promise<ProductRow> {
  const name = portionProductName(whole.name, portionSize)
  try {
    const [bag] = await tx
      .insert(products)
      .values({
        name,
        categoryId: whole.categoryId,
        image: whole.image,
        price,
        unitCost: portionUnitCost,
        portionSize,
        fractionable: false,
        active: true,
        parentProductId: whole.id,
      })
      .returning()
    if (!bag) throw new Error('La bolsita no quedó registrada')
    return bag
  } catch (err) {
    if (isUniqueViolation(err) && pgConstraintName(err) === PRODUCT_NAME_CONSTRAINT) {
      throw conflict(duplicatePortionName(name))
    }
    throw err
  }
}

// Todo lo que escribe el fraccionado, dentro de la transacción. El entero se bloquea primero para que
// dos fraccionados del mismo entero no creen dos bolsitas ni calculen con un saldo viejo.
async function writeFraction(tx: Tx, input: CreateFractionInput, actor: FractionActor): Promise<FractionRow> {
  const [whole] = await lockRows(tx, products, eq(products.id, input.productId))
  if (!whole || !whole.active) throw notFound()
  // Sin porción definida no hay nombre para la bolsita; se trata igual que un producto no fraccionable.
  const portionSize = whole.portionSize
  if (!whole.fractionable || !portionSize) throw validation(NOT_FRACTIONABLE)

  const [bag] = await tx.select().from(products).where(eq(products.parentProductId, whole.id))

  // Costo por bolsita en unidades enteras, redondeado una sola vez (450.0000 ÷ 7 = 64.2857).
  const portionUnitCost = divideMoney(whole.unitCost, 4, input.portions)
  if (compareMoney(portionUnitCost, 4, '0', 4) === 0) throw validation(PORTION_COST_ZERO)

  // La bolsita nueva necesita precio. La reusada conserva el suyo si no viene uno nuevo.
  const price = input.price ?? bag?.price ?? null
  if (price === null) throw validation(PRICE_REQUIRED)
  if (compareMoney(price, 2, portionUnitCost, 4) < 0) throw validation(PRICE_BELOW_COST)

  // Reactivar la bolsita devuelve al catálogo una que estaba archivada; nombre, categoría, foto y porción
  // no se resincronizan con el entero.
  const portion = bag
    ? await updatePortionProduct(tx, bag.id, portionUnitCost, price)
    : await insertPortionProduct(tx, whole, portionSize, portionUnitCost, price)

  const [row] = await tx
    .insert(fractions)
    .values({
      requestId: input.requestId,
      productId: whole.id,
      portionProductId: portion.id,
      portions: input.portions,
      wholeUnitCost: whole.unitCost,
      portionUnitCost,
      portionPrice: price,
      createdBy: actor.userId,
    })
    .returning()
  if (!row) throw new Error('El fraccionado no quedó registrado')

  await insertMovements(tx, [
    {
      productId: whole.id,
      type: 'fraction_out',
      qty: -WHOLE_UNITS_PER_FRACTION,
      holderProfileId: null,
      createdBy: actor.userId,
      fractionId: row.id,
    },
    {
      productId: portion.id,
      type: 'fraction_in',
      qty: input.portions,
      holderProfileId: null,
      createdBy: actor.userId,
      fractionId: row.id,
    },
  ])
  return row
}

// Reusa la bolsita: sobrescribe el costo por bolsita, reactiva si estaba desactivada y cambia el precio
// solo si vino uno nuevo (el que llega aquí ya es el efectivo).
async function updatePortionProduct(tx: Tx, id: number, portionUnitCost: string, price: string): Promise<ProductRow> {
  const [updated] = await tx
    .update(products)
    .set({ unitCost: portionUnitCost, price, active: true })
    .where(eq(products.id, id))
    .returning()
  if (!updated) throw notFound()
  return updated
}

// Fracciona 1 entero de la bodega en N bolsitas (T-24) en una sola transacción: el entero baja 1, la
// bolsita sube N y se guarda el fraccionado. Una repetición con el mismo requestId responde el fraccionado
// ya hecho (replayed: true) y, si dos iguales llegan a la vez, el índice único deja pasar una y la otra
// cae en esa misma respuesta.
export async function createFraction(
  input: CreateFractionInput,
  actor: FractionActor,
): Promise<{ fraction: Fraction; replayed: boolean }> {
  if (actor.role !== 'admin') throw forbidden()
  assertPortions(input.portions)

  const replay = await findReplay(input)
  if (replay) return { fraction: replay, replayed: true }

  try {
    const row = await withTransaction((tx) => writeFraction(tx, input, actor))
    return { fraction: await toFraction(row), replayed: false }
  } catch (err) {
    if (isUniqueViolation(err) && pgConstraintName(err) === FRACTION_REQUEST_CONSTRAINT) {
      const raced = await findReplay(input)
      if (raced) return { fraction: raced, replayed: true }
    }
    throw err
  }
}

// Resumen de un fraccionado por su requestId; sobrevive a una recarga.
export async function getFraction(requestId: string): Promise<Fraction> {
  const [row] = await db.select().from(fractions).where(eq(fractions.requestId, requestId))
  if (!row) throw notFound()
  return toFraction(row)
}

// Esqueleto de HU-23: lista los enteros fraccionables con su bolsita. Sin implementar.
export async function listFractionOptions(): Promise<FractionOption[]> {
  throw new Error('listFractionOptions sin implementar')
}
