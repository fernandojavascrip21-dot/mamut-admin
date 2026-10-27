import { asc, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { isForeignKeyViolation, isUniqueViolation } from '../db/errors'
import { products, stockMovements } from '../db/schema'
import { withTransaction } from '../db/transaction'
import { conflict, validation } from '../lib/errors'

export interface CreateProductInput {
  name: string
  categoryId: number | null
  price: number
  unitCost: number
  initialQty: number
  fractionable: boolean
  portionSize: string | null
  image: string | null
}

const DUPLICATE_NAME = 'Ya existe un producto con ese nombre'

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
// que entran nacen como un movimiento de stock, nunca como un número suelto). Traduce la
// violación del índice único de nombre a 409 y la de la FK de categoryId a 422, en vez de
// dejar que cualquiera de las dos llegue como 500.
export async function createProduct(input: CreateProductInput, createdBy: string) {
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
          price: String(input.price),
          unitCost: String(input.unitCost),
          stock: input.initialQty,
          fractionable: input.fractionable,
          portionSize: input.fractionable ? input.portionSize : null,
          image: input.image ?? '',
        })
        .returning()

      await tx.insert(stockMovements).values({
        productId: product!.id,
        type: 'initial',
        qty: input.initialQty,
        holderProfileId: null,
        createdBy,
      })

      return product!
    })
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(DUPLICATE_NAME)
    if (isForeignKeyViolation(err)) throw validation('La categoría no existe')
    throw err
  }
}
