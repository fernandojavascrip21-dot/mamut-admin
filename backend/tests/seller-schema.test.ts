import { and, desc, eq, ilike, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, sql } from '../src/db/client'
import { isCheckViolation } from '../src/db/errors'
import { products, profiles, stockMovements, vendorStock } from '../src/db/schema'
import { withTransaction } from '../src/db/transaction'
import { insertMovements } from '../src/stock/movements'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

// Prefijo identificable para limpiar sin tocar el catálogo real.
const PREFIX = 'test-seller-schema-'

// Igual que en stock-movements.test.ts: movimientos del más nuevo al más viejo (el trigger
// revierte cada uno), luego vendor_stock y productos, por los FK `restrict`.
async function cleanupStock() {
  const rows = await db.select({ id: products.id }).from(products).where(ilike(products.name, `${PREFIX}%`))
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return
  const movements = await db.select({ id: stockMovements.id }).from(stockMovements)
    .where(inArray(stockMovements.productId, ids)).orderBy(desc(stockMovements.id))
  for (const movement of movements) {
    await db.delete(stockMovements).where(eq(stockMovements.id, movement.id))
  }
  await db.delete(vendorStock).where(inArray(vendorStock.productId, ids))
  await db.delete(products).where(inArray(products.id, ids))
}

// El error de la base que dejó el intento.
async function dbError(fn: () => Promise<unknown>) {
  try {
    await fn()
  } catch (err) {
    return err
  }
  throw new Error('se esperaba que la base rechazara la operación')
}

describe.skipIf(!hasServiceKey)('base de vendedores: teléfono y precios por vendedor (spec T-10)', () => {
  let admin: TestUser
  let seller: TestUser

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    admin = await createTestUser('seller-schema-admin', { role: 'admin' })
    seller = await createTestUser('seller-schema-vendedor', { role: 'vendedor' })
  }, 60_000)

  afterAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  describe('profiles.phone', () => {
    // Cuenta de Auth sin perfil, para probar el insert del perfil a mano.
    const insertProfile = async (role: 'admin' | 'vendedor', phone: string | null) => {
      const account = await createTestUser(`seller-schema-${role}-${Math.floor(Math.random() * 1e5)}`, null)
      return db.insert(profiles).values({ id: account.id, role, fullName: 'Prueba T-10', phone })
    }

    it('un vendedor sin teléfono se rechaza', async () => {
      const err = await dbError(() => insertProfile('vendedor', null))
      expect(isCheckViolation(err, 'profiles_seller_phone_required_check')).toBe(true)
    })

    it.each(['551234567', '55123456789', '55 1234 5678', '+525512345678'])('el teléfono «%s» se rechaza', async (phone) => {
      const err = await dbError(() => insertProfile('vendedor', phone))
      expect(isCheckViolation(err, 'profiles_phone_format_check')).toBe(true)
    })

    it('un vendedor con 10 dígitos y un administrador sin teléfono se aceptan', async () => {
      await insertProfile('vendedor', '5512345678')
      await insertProfile('admin', null)
      const [row] = await db.select({ phone: profiles.phone }).from(profiles).where(eq(profiles.id, seller.id))
      expect(row!.phone).toMatch(/^[0-9]{10}$/)
    })
  })

  describe('vendor_stock.unit_price y unit_cost_with_shipping', () => {
    let productId: number

    // La fila de vendor_stock nace con el movimiento `delivery`, no con un insert directo (T-07).
    beforeAll(async () => {
      const [product] = await db.insert(products)
        .values({ name: `${PREFIX}${Date.now()}`, price: '100', unitCost: '50' }).returning()
      productId = product!.id
      await withTransaction((tx) => insertMovements(tx, [
        { productId, type: 'initial', qty: 5, holderProfileId: null, createdBy: admin.id },
      ]))
      await withTransaction((tx) => insertMovements(tx, [
        { productId, type: 'delivery', qty: -2, holderProfileId: null, createdBy: admin.id },
        { productId, type: 'delivery', qty: 2, holderProfileId: seller.id, createdBy: admin.id },
      ]))
    })

    const setPrices = (values: { unitPrice?: string | null; unitCostWithShipping?: string | null }) =>
      db.update(vendorStock).set(values)
        .where(and(eq(vendorStock.profileId, seller.id), eq(vendorStock.productId, productId)))

    it('un precio o un costo de 0 se rechaza', async () => {
      expect(isCheckViolation(await dbError(() => setPrices({ unitPrice: '0' })), 'vendor_stock_unit_price_check')).toBe(true)
      expect(isCheckViolation(
        await dbError(() => setPrices({ unitCostWithShipping: '0' })),
        'vendor_stock_unit_cost_with_shipping_check',
      )).toBe(true)
    })

    it('nulos o mayores que 0 se aceptan, sin tocar las piezas', async () => {
      await setPrices({ unitPrice: '120.50', unitCostWithShipping: '55.1234' })
      await setPrices({ unitPrice: null, unitCostWithShipping: null })
      await setPrices({ unitPrice: '0.01', unitCostWithShipping: '0.0001' })
      const [row] = await db.select().from(vendorStock)
        .where(and(eq(vendorStock.profileId, seller.id), eq(vendorStock.productId, productId)))
      expect(row).toMatchObject({ qty: 2, unitPrice: '0.01', unitCostWithShipping: '0.0001' })
    })
  })
})
