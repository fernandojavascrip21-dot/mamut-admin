import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
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
  const creatorId = await creatorFractionId(row.portionProductId)
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
      created: creatorId === row.id,
      price: row.portionPrice,
      stock: bag.stock,
    },
  }
}

// El fraccionado más antiguo de una bolsita es el que la creó; solo ese guardó la porción de la petición.
async function creatorFractionId(portionProductId: number): Promise<number | undefined> {
  const [oldest] = await db
    .select({ id: fractions.id })
    .from(fractions)
    .where(eq(fractions.portionProductId, portionProductId))
    .orderBy(asc(fractions.id))
    .limit(1)
  return oldest?.id
}

// La porción solo se compara si la petición la trae y el fraccionado creó la bolsita. En una bolsita
// reusada la porción se ignora, así que repetir esa petición no debe dar 409. Se compara con la
// porción guardada en la bolsita.
async function samePortionSize(row: FractionRow, portionSize: string | null | undefined): Promise<boolean> {
  if (portionSize === undefined || portionSize === null) return true
  if ((await creatorFractionId(row.portionProductId)) !== row.id) return true
  const bag = await findProduct(row.portionProductId)
  return bag.portionSize === portionSize
}

// Si el requestId ya existe, responde ese fraccionado. Con el mismo entero y porciones, el mismo
// precio si se mandó uno y la misma porción si aplica, es una repetición; con otros datos, 409. Sin
// `price` no hay con qué comparar el precio, porque la tabla guarda el precio tras el fraccionado y no
// el que se mandó.
async function findReplay(input: CreateFractionInput): Promise<Fraction | null> {
  const [row] = await db.select().from(fractions).where(eq(fractions.requestId, input.requestId))
  if (!row) return null
  const samePrice = input.price === null || compareMoney(input.price, 2, row.portionPrice, 2) === 0
  const sameSize = await samePortionSize(row, input.portionSize)
  if (row.productId !== input.productId || row.portions !== input.portions || !samePrice || !sameSize) {
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
  const wholePortionSize = whole.portionSize
  if (!whole.fractionable || !wholePortionSize) throw validation(NOT_FRACTIONABLE)

  const [bag] = await tx.select().from(products).where(eq(products.parentProductId, whole.id))
  // Solo la bolsita nueva usa la porción de la petición; si ya existe, su porción no cambia.
  const portionSize = input.portionSize ?? wholePortionSize

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

// Enteros activos que se fraccionan, con sus piezas en bodega y su bolsita si ya existe. La bolsita se
// busca por parent_product_id (único) y se incluye aunque esté desactivada: createFraction la reactiva.
// Solo lee; los saldos vienen del trigger de stock, nunca se suman aquí.
export async function listFractionOptions(): Promise<FractionOption[]> {
  const wholes = await db
    .select()
    .from(products)
    .where(and(eq(products.fractionable, true), eq(products.active, true), isNotNull(products.portionSize)))
    .orderBy(asc(sql`lower(${products.name})`))
  if (wholes.length === 0) return []

  const bags = await db
    .select()
    .from(products)
    .where(inArray(products.parentProductId, wholes.map((whole) => whole.id)))
  const bagByParent = new Map(bags.map((bag) => [bag.parentProductId, bag]))

  return wholes.map((whole) => {
    const bag = bagByParent.get(whole.id)
    return {
      productId: whole.id,
      name: whole.name,
      image: whole.image || null,
      warehouseUnits: whole.stock,
      unitCost: whole.unitCost,
      portionSize: whole.portionSize ?? '',
      portionProduct: bag
        ? { id: bag.id, name: bag.name, price: bag.price, active: bag.active }
        : null,
    }
  })
}
