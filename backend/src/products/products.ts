import { and, asc, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { isForeignKeyViolation, isUniqueViolation } from '../db/errors'
import { products } from '../db/schema'
import { withTransaction } from '../db/transaction'
import { conflict, notFound, validation } from '../lib/errors'
import { compareMoney } from '../lib/money'
import { insertMovements } from '../stock'
import { DUPLICATE_NAME, PRICE_BELOW_COST } from './constants'

export interface CreateProductInput {
  name: string
  categoryId: number | null
  price: string    // texto normalizado por requireMoney (escala 2)
  unitCost: string // escala 4
  initialQty: number
  fractionable: boolean
  portionSize: string | null
  image: string | null
}

export interface UpdateProductInput {
  name: string
  categoryId: number | null
  price: string    // texto normalizado por requireMoney (escala 2)
  unitCost: string // escala 4
  fractionable: boolean
  portionSize: string | null
  image: string
}

// Regla de HU-06 en unidades enteras (spec T-08): precio escala 2 contra costo escala 4.
const priceBelowCost = (input: { price: string; unitCost: string }) =>
  compareMoney(input.price, 2, input.unitCost, 4) < 0

// Lista para la pantalla 03: solo productos activos, y nunca unitCost (RNF-04), aunque
// hoy el endpoint ya es solo para administrador.
export function listProducts() {
  return db
    .select({
      id: products.id,
      name: products.name,
      categoryId: products.categoryId,
      price: products.price,
      stock: products.stock,
      fractionable: products.fractionable,
      image: products.image,
    })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.name))
}

// Inserta el producto y su movimiento `initial` en una sola transacción (RNF-05: las piezas
// que entran nacen como un movimiento de stock, nunca como un número suelto). El producto nace
// con stock 0 y el trigger de stock_movements lo sube (T-07), por eso se relee al final. Traduce la
// violación del índice único de nombre a 409 y la de la FK de categoryId a 422, en vez de
// dejar que cualquiera de las dos llegue como 500.
export async function createProduct(input: CreateProductInput, createdBy: string) {
  if (priceBelowCost(input)) throw validation(PRICE_BELOW_COST)
  if (input.fractionable && !input.portionSize) {
    throw validation('Falta el campo portionSize para un producto que se fracciona')
  }

  try {
    return await withTransaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({
          name: input.name,
          categoryId: input.categoryId,
          price: input.price,
          unitCost: input.unitCost,
          fractionable: input.fractionable,
          portionSize: input.fractionable ? input.portionSize : null,
          image: input.image ?? '',
        })
        .returning()

      await insertMovements(tx, [{
        productId: product!.id,
        type: 'initial',
        qty: input.initialQty,
        holderProfileId: null,
        createdBy,
      }])

      const [created] = await tx.select().from(products).where(eq(products.id, product!.id))
      return created!
    })
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(DUPLICATE_NAME)
    if (isForeignKeyViolation(err)) throw validation('La categoría no existe')
    throw err
  }
}

// El formulario necesita costo y porción, que la lista omite; los inactivos no se editan.
export async function getProduct(id: number) {
  const [product] = await db.select().from(products).where(and(eq(products.id, id), eq(products.active, true)))
  if (!product) throw notFound()
  return product
}

// Solo escribe los campos editables. Las piezas y sus movimientos pertenecen al flujo de bodega.
export async function updateProduct(id: number, input: UpdateProductInput) {
  if (priceBelowCost(input)) throw validation(PRICE_BELOW_COST)
  if (input.fractionable && !input.portionSize) {
    throw validation('Falta el campo portionSize para un producto que se fracciona')
  }

  try {
    const [product] = await db.update(products).set({
      name: input.name,
      categoryId: input.categoryId,
      price: input.price,
      unitCost: input.unitCost,
      fractionable: input.fractionable,
      portionSize: input.fractionable ? input.portionSize : null,
      image: input.image,
    }).where(and(eq(products.id, id), eq(products.active, true))).returning()
    if (!product) throw notFound()
    return product
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(DUPLICATE_NAME)
    if (isForeignKeyViolation(err)) throw validation('La categoría no existe')
    throw err
  }
}
