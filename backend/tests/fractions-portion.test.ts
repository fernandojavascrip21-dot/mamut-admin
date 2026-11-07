import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, sql } from '@db/client'
import { products, stockMovements } from '@db/schema'
import { createProduct } from '@products'
import { createFraction, type CreateFractionInput } from '@fractions'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-fracp-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// Movimientos del más nuevo al más viejo (revierten saldos), luego fractions, bolsitas y enteros.
async function cleanupFractions() {
  const rows = await db.select({ id: products.id }).from(products).where(ilike(products.name, `${PREFIX}%`))
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return
  const bags = await db.select({ id: products.id }).from(products).where(inArray(products.parentProductId, ids))
  const all = [...ids, ...bags.map((bag) => bag.id)]
  const movements = await db.select({ id: stockMovements.id }).from(stockMovements)
    .where(inArray(stockMovements.productId, all)).orderBy(desc(stockMovements.id))
  for (const movement of movements) {
    await db.delete(stockMovements).where(eq(stockMovements.id, movement.id))
  }
  await sql`delete from fractions where product_id = any(${ids}) or portion_product_id = any(${all})`
  if (bags.length > 0) await db.delete(products).where(inArray(products.id, bags.map((bag) => bag.id)))
  await db.delete(products).where(inArray(products.id, ids))
}

describe.skipIf(!hasServiceKey)('Fraccionar con porción propia (portionSize, base real)', () => {
  let admin: TestUser

  const newWhole = async () => {
    const created = await createProduct({
      name: productName('entero'),
      categoryId: null,
      price: '900.00',
      unitCost: '450.0000',
      initialQty: 5,
      fractionable: true,
      portionSize: '250 g',
      image: null,
    }, admin.id)
    return created.id as number
  }
  const input = (productId: number, extra: Record<string, unknown> = {}): CreateFractionInput =>
    ({ requestId: randomUUID(), productId, portions: 7, price: '85.00', ...extra }) as CreateFractionInput
  const asAdmin = () => ({ userId: admin.id, role: 'admin' })
  const productOf = async (id: number) => (await db.select().from(products).where(eq(products.id, id)))[0]!

  beforeAll(async () => {
    admin = await createTestUser('fracp-admin', { role: 'admin' })
  })
  afterAll(async () => {
    await cleanupFractions()
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  })

  it('una bolsita nueva usa el portionSize recibido en el nombre y en la columna', async () => {
    const id = await newWhole()
    const whole = await productOf(id)
    const { fraction } = await createFraction(input(id, { portionSize: '30 g' }), asAdmin())
    const bag = await productOf(fraction.portionProduct.id)
    expect(bag.name).toBe(`${whole.name} · bolsita 30 g`)
    expect(bag.portionSize).toBe('30 g')
    expect(fraction.portionProduct.name).toBe(`${whole.name} · bolsita 30 g`)
  })

  it('sin portionSize la bolsita nueva usa la porción del entero', async () => {
    const id = await newWhole()
    const whole = await productOf(id)
    const { fraction } = await createFraction(input(id), asAdmin())
    const bag = await productOf(fraction.portionProduct.id)
    expect(bag.name).toBe(`${whole.name} · bolsita 250 g`)
    expect(bag.portionSize).toBe('250 g')
  })

  it('con la bolsita ya creada el portionSize se ignora: nombre y porción no cambian', async () => {
    const id = await newWhole()
    const first = await createFraction(input(id, { portionSize: '30 g' }), asAdmin())
    const second = await createFraction(input(id, { portionSize: '99 g', price: null }), asAdmin())
    expect(second.fraction.portionProduct.id).toBe(first.fraction.portionProduct.id)
    expect(second.fraction.portionProduct.created).toBe(false)
    const bag = await productOf(first.fraction.portionProduct.id)
    expect(bag.portionSize).toBe('30 g')
    expect(bag.name).toBe(first.fraction.portionProduct.name)
  })

  it('repetir el requestId con el mismo portionSize o sin él responde la repetición', async () => {
    const id = await newWhole()
    const body = input(id, { portionSize: '30 g' })
    await createFraction(body, asAdmin())
    const same = await createFraction({ ...body }, asAdmin())
    expect(same.replayed).toBe(true)
    const without = await createFraction({ ...body, portionSize: undefined } as CreateFractionInput, asAdmin())
    expect(without.replayed).toBe(true)
  })

  it('repetir el requestId con otro portionSize es 409', async () => {
    const id = await newWhole()
    const body = input(id, { portionSize: '30 g' })
    await createFraction(body, asAdmin())
    await expect(createFraction({ ...body, portionSize: '45 g' } as CreateFractionInput, asAdmin()))
      .rejects.toMatchObject({ code: 'conflict' })
  })
})
