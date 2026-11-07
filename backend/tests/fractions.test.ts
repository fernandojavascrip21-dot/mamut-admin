import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, sql } from '@db/client'
import { products, stockMovements } from '@db/schema'
import { createProduct } from '@products'
import { createFraction, getFraction, type CreateFractionInput } from '@fractions'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-frac-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// Movimientos del más nuevo al más viejo (revierten saldos), luego fractions, bolsitas y enteros.
async function cleanupFractions() {
  const rows = await db.select({ id: products.id }).from(products).where(ilike(products.name, `${PREFIX}%`))
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return
  const movements = await db.select({ id: stockMovements.id }).from(stockMovements)
    .where(inArray(stockMovements.productId, ids)).orderBy(desc(stockMovements.id))
  for (const movement of movements) {
    await db.delete(stockMovements).where(eq(stockMovements.id, movement.id))
  }
  await sql`delete from fractions where product_id = any(${ids}) or portion_product_id = any(${ids})`
  const portions = await db.select({ id: products.id }).from(products).where(inArray(products.parentProductId, ids))
  if (portions.length > 0) await db.delete(products).where(inArray(products.id, portions.map((p) => p.id)))
  await db.delete(products).where(inArray(products.id, ids))
}

describe.skipIf(!hasServiceKey)('Fraccionar un entero en bolsitas (T-24, base real)', () => {
  let admin: TestUser
  let seller: TestUser

  const newWhole = async (opts: { qty?: number; fractionable?: boolean; unitCost?: string; price?: string } = {}) => {
    const created = await createProduct({
      name: productName('entero'),
      categoryId: null,
      price: opts.price ?? '900.00',
      unitCost: opts.unitCost ?? '450.0000',
      initialQty: opts.qty ?? 3,
      fractionable: opts.fractionable ?? true,
      portionSize: opts.fractionable === false ? null : '250 g',
      image: null,
    }, admin.id)
    return created.id as number
  }

  const input = (productId: number, extra: Partial<CreateFractionInput> = {}): CreateFractionInput =>
    ({ requestId: randomUUID(), productId, portions: 7, price: '85.00', ...extra })
  const asAdmin = () => ({ userId: admin.id, role: 'admin' })

  const movementsOf = (productId: number) =>
    db.select().from(stockMovements).where(eq(stockMovements.productId, productId)).orderBy(stockMovements.id)
  const productOf = async (id: number) => (await db.select().from(products).where(eq(products.id, id)))[0]!
  const countRows = async (productId: number) => {
    const [fr] = await sql`select count(*)::int as n from fractions where product_id = ${productId}`
    const [pr] = await db.select().from(products).where(eq(products.parentProductId, productId))
    return { fractions: fr!.n as number, movements: (await movementsOf(productId)).length, bag: pr ? 1 : 0 }
  }

  beforeAll(async () => {
    admin = await createTestUser('frac-admin', { role: 'admin' })
    seller = await createTestUser('frac-seller', { role: 'vendedor' })
  })
  afterAll(async () => {
    await cleanupFractions()
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  })

  it('fracciona 1 entero de 3 en 7 bolsitas con dos movimientos de bodega y el mismo fraction_id', async () => {
    const id = await newWhole({ qty: 3 })
    const { fraction, replayed } = await createFraction(input(id), asAdmin())
    expect(replayed).toBe(false)
    expect(fraction.product.stock).toBe(2)
    expect(fraction.portionProduct.stock).toBe(7)
    const out = (await movementsOf(id)).filter((m) => m.type === 'fraction_out')
    const into = (await movementsOf(fraction.portionProduct.id)).filter((m) => m.type === 'fraction_in')
    expect(out).toHaveLength(1)
    expect(into).toHaveLength(1)
    expect(out[0]).toMatchObject({ qty: -1, holderProfileId: null })
    expect(into[0]).toMatchObject({ qty: 7, holderProfileId: null })
    const [row] = await sql`select id from fractions where request_id = ${fraction.requestId}`
    expect(Number(row!.id)).toBe(fraction.id)
  })

  it('con costo 450.0000 y 7 bolsitas el costo por bolsita es 64.2857 y se guarda en la bolsita', async () => {
    const id = await newWhole({ unitCost: '450.0000' })
    const { fraction } = await createFraction(input(id), asAdmin())
    expect(fraction.wholeUnitCost).toBe('450.0000')
    expect(fraction.portionUnitCost).toBe('64.2857')
    expect((await productOf(fraction.portionProduct.id)).unitCost).toBe('64.2857')
  })

  it('el primer fraccionado crea la bolsita con nombre, porción y padre del entero', async () => {
    const id = await newWhole()
    const whole = await productOf(id)
    const { fraction } = await createFraction(input(id), asAdmin())
    const bag = await productOf(fraction.portionProduct.id)
    expect(fraction.portionProduct.created).toBe(true)
    expect(bag.name).toBe(`${whole.name} · bolsita ${whole.portionSize}`)
    expect(bag).toMatchObject({
      parentProductId: id, fractionable: false, active: true, categoryId: whole.categoryId,
      image: whole.image, portionSize: whole.portionSize,
    })
  })

  it('un segundo fraccionado reusa la bolsita, sobrescribe el costo y conserva el precio sin price', async () => {
    const id = await newWhole({ qty: 3, unitCost: '450.0000' })
    const first = await createFraction(input(id), asAdmin())
    await db.update(products).set({ unitCost: '400.0000' }).where(eq(products.id, id))
    const second = await createFraction(input(id, { portions: 8, price: null }), asAdmin())
    expect(second.fraction.portionProduct.id).toBe(first.fraction.portionProduct.id)
    expect(second.fraction.portionProduct.created).toBe(false)
    expect(second.fraction.portionUnitCost).toBe('50.0000')
    expect(second.fraction.portionProduct.price).toBe('85.00')
    expect(second.fraction.portionProduct.stock).toBe(15)
  })

  it('con price en el segundo fraccionado sobrescribe el precio de la bolsita', async () => {
    const id = await newWhole()
    await createFraction(input(id), asAdmin())
    const { fraction } = await createFraction(input(id, { price: '95.00' }), asAdmin())
    expect(fraction.portionProduct.price).toBe('95.00')
  })

  it('reactiva una bolsita desactivada', async () => {
    const id = await newWhole()
    const first = await createFraction(input(id), asAdmin())
    await db.update(products).set({ active: false }).where(eq(products.id, first.fraction.portionProduct.id))
    await createFraction(input(id, { price: null }), asAdmin())
    expect((await productOf(first.fraction.portionProduct.id)).active).toBe(true)
  })

  it('409 «No hay piezas suficientes» sin escribir nada si el entero está en 0', async () => {
    const id = await newWhole({ qty: 0 })
    await expect(createFraction(input(id), asAdmin())).rejects.toMatchObject({
      code: 'conflict', message: 'No hay piezas suficientes',
    })
    expect(await countRows(id)).toEqual({ fractions: 0, movements: 0, bag: 0 })
  })

  it('422 si el producto no es fraccionable', async () => {
    const id = await newWhole({ fractionable: false })
    await expect(createFraction(input(id), asAdmin())).rejects.toMatchObject({
      code: 'validation', message: 'Este producto no se fracciona',
    })
  })

  it('404 si el producto no existe o está desactivado', async () => {
    await expect(createFraction(input(2_000_000_000), asAdmin())).rejects.toMatchObject({ code: 'not_found' })
    const id = await newWhole()
    await db.update(products).set({ active: false }).where(eq(products.id, id))
    await expect(createFraction(input(id), asAdmin())).rejects.toMatchObject({ code: 'not_found' })
  })

  it('403 si quien fracciona es un vendedor', async () => {
    const id = await newWhole()
    await expect(createFraction(input(id), { userId: seller.id, role: 'vendedor' })).rejects.toMatchObject({ code: 'forbidden' })
    expect(await countRows(id)).toMatchObject({ fractions: 0, bag: 0 })
  })

  it.each([1, 1001, 2.5])('422 con portions = %s', async (portions) => {
    const id = await newWhole()
    await expect(createFraction(input(id, { portions }), asAdmin())).rejects.toMatchObject({ code: 'validation' })
  })

  it('422 sin price al crear la bolsita', async () => {
    const id = await newWhole()
    await expect(createFraction(input(id, { price: null }), asAdmin())).rejects.toMatchObject({ code: 'validation' })
    expect((await countRows(id)).bag).toBe(0)
  })

  it('422 si el precio es menor que el costo por bolsita (64.2857)', async () => {
    const id = await newWhole()
    await expect(createFraction(input(id, { price: '64.28' }), asAdmin())).rejects.toMatchObject({ code: 'validation' })
  })

  it('422 si el costo por bolsita queda en 0.0000', async () => {
    const id = await newWhole({ unitCost: '0.0001', price: '1.00' })
    await expect(createFraction(input(id, { portions: 3 }), asAdmin())).rejects.toMatchObject({ code: 'validation' })
  })

  it('409 si el nombre de la bolsita lo usa otro producto, sin escribir nada', async () => {
    const id = await newWhole()
    const whole = await productOf(id)
    await db.insert(products).values({ name: `${whole.name} · bolsita ${whole.portionSize}`, price: '1', unitCost: '1' })
    await expect(createFraction(input(id), asAdmin())).rejects.toMatchObject({ code: 'conflict' })
    expect(await countRows(id)).toEqual({ fractions: 0, movements: 1, bag: 0 })
  })

  it('repetir el requestId con los mismos datos da replayed: true y no mueve piezas', async () => {
    const id = await newWhole({ qty: 3 })
    const body = input(id)
    const first = await createFraction(body, asAdmin())
    const again = await createFraction(body, asAdmin())
    expect(again.replayed).toBe(true)
    expect(again.fraction.id).toBe(first.fraction.id)
    expect((await productOf(id)).stock).toBe(2)
  })

  it('409 al repetir el requestId con otros datos', async () => {
    const id = await newWhole()
    const body = input(id)
    await createFraction(body, asAdmin())
    await expect(createFraction({ ...body, portions: 8 }, asAdmin())).rejects.toMatchObject({
      code: 'conflict', message: 'Este fraccionado ya se registró con otros datos.',
    })
  })

  it('dos peticiones iguales a la vez dejan un solo fraccionado', async () => {
    const id = await newWhole({ qty: 3 })
    const body = input(id)
    const results = await Promise.all([createFraction(body, asAdmin()), createFraction(body, asAdmin())])
    expect(results.map((r) => r.replayed).sort()).toEqual([false, true])
    expect((await countRows(id)).fractions).toBe(1)
    expect((await productOf(id)).stock).toBe(2)
  })

  it('getFraction devuelve el fraccionado y 404 si no existe', async () => {
    const id = await newWhole()
    const { fraction } = await createFraction(input(id), asAdmin())
    expect((await getFraction(fraction.requestId)).id).toBe(fraction.id)
    await expect(getFraction(randomUUID())).rejects.toMatchObject({ code: 'not_found' })
  })
})
