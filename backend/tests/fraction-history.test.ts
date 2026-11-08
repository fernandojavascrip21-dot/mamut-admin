import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as historyRoute } from '@api/fractions/route'
import { db, sql } from '@db/client'
import { products, stockMovements } from '@db/schema'
import { createFraction, FRACTION_HISTORY_LIMIT, listFractions, type FractionHistoryItem } from '@fractions'
import { createProduct } from '@products'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-frac-h-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

const req = (token?: string) =>
  new Request('http://api.test/api/fractions', { method: 'GET', headers: token ? { authorization: `Bearer ${token}` } : {} })

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

describe.skipIf(!hasServiceKey)('Historial de fraccionados (HU-24, base real)', () => {
  let admin: TestUser
  let seller: TestUser

  const newWhole = async (qty = 3) => {
    const created = await createProduct({
      name: productName('entero'), categoryId: null, price: '900.00', unitCost: '450.0000', initialQty: qty,
      fractionable: true, portionSize: '250 g', image: null,
    }, admin.id)
    return created.id as number
  }
  const fraction = (productId: number, portions = 7) =>
    createFraction({ requestId: randomUUID(), productId, portions, price: '85.00' }, { userId: admin.id, role: 'admin' })
  const mine = (items: FractionHistoryItem[], wholeIds: number[]) => items.filter((item) => wholeIds.includes(item.product.id))

  beforeAll(async () => {
    admin = await createTestUser('frac-h-admin', { role: 'admin' })
    seller = await createTestUser('frac-h-seller', { role: 'vendedor' })
  })
  afterAll(async () => {
    await cleanupFractions()
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  })

  it('FRACTION_HISTORY_LIMIT vale 50', () => {
    expect(FRACTION_HISTORY_LIMIT).toBe(50)
  })

  it('trae los campos del fraccionado y el nombre de quien lo hizo', async () => {
    const id = await newWhole()
    const { fraction: created } = await fraction(id)
    const item = (await listFractions()).find((row) => row.id === created.id)!
    expect(item).toMatchObject({
      id: created.id, requestId: created.requestId, portions: 7,
      wholeUnitCost: '450.0000', portionUnitCost: '64.2857', portionPrice: '85.00',
      product: { id, name: created.product.name },
      portionProduct: { id: created.portionProduct.id, name: created.portionProduct.name },
      createdBy: { id: admin.id, name: 'Prueba frac-h-admin' },
    })
    expect(typeof item.createdAt).toBe('string')
  })

  it('ordena del más reciente al más viejo', async () => {
    const id = await newWhole(5)
    const first = await fraction(id)
    const second = await fraction(id)
    const third = await fraction(id)
    const ids = (await listFractions()).map((row) => row.id)
    expect(ids.indexOf(third.fraction.id)).toBeLessThan(ids.indexOf(second.fraction.id))
    expect(ids.indexOf(second.fraction.id)).toBeLessThan(ids.indexOf(first.fraction.id))
  })

  it('con la misma fecha desempata por id descendente', async () => {
    const id = await newWhole()
    const { fraction: base } = await fraction(id)
    const insert = async () => {
      const [row] = await sql`
        insert into fractions (request_id, product_id, portion_product_id, portions, whole_unit_cost, portion_unit_cost, portion_price, created_by, created_at)
        values (${randomUUID()}, ${id}, ${base.portionProduct.id}, 2, '450.0000', '225.0000', '300.00', ${admin.id}, now() + interval '2 days')
        returning id`
      return Number(row!.id)
    }
    const lower = await insert()
    const higher = await insert()
    const ids = (await listFractions()).map((row) => row.id)
    expect(ids.indexOf(higher)).toBeLessThan(ids.indexOf(lower))
  })

  it('devuelve como máximo FRACTION_HISTORY_LIMIT y deja fuera al más viejo', async () => {
    const id = await newWhole()
    const { fraction: oldest } = await fraction(id)
    const inserted: string[] = []
    try {
      for (let i = 0; i < FRACTION_HISTORY_LIMIT; i += 1) {
        const requestId = randomUUID()
        inserted.push(requestId)
        await sql`
          insert into fractions (request_id, product_id, portion_product_id, portions, whole_unit_cost, portion_unit_cost, portion_price, created_by, created_at)
          values (${requestId}, ${id}, ${oldest.portionProduct.id}, 2, '450.0000', '225.0000', '300.00', ${admin.id}, now() + (${i + 1} * interval '1 minute') + interval '10 days')`
      }
      const items = await listFractions()
      expect(items).toHaveLength(FRACTION_HISTORY_LIMIT)
      expect(items.map((row) => row.id)).not.toContain(oldest.id)
    } finally {
      // Las filas con fecha futura llenarían el top 50 de los `it` siguientes: se borran al terminar.
      await sql`delete from fractions where request_id = any(${inserted})`
    }
  })

  it('incluye fraccionados de productos desactivados', async () => {
    const id = await newWhole()
    const { fraction: created } = await fraction(id)
    await db.update(products).set({ active: false }).where(inArray(products.id, [id, created.portionProduct.id]))
    const item = mine(await listFractions(), [id])
    expect(item.map((row) => row.id)).toContain(created.id)
  })

  it('la ruta responde 200 { fractions } al administrador', async () => {
    const response = await historyRoute(req(admin.token), undefined)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { fractions: FractionHistoryItem[] }
    expect(body.fractions.length).toBeGreaterThan(0)
    expect(body.fractions.length).toBeLessThanOrEqual(FRACTION_HISTORY_LIMIT)
  })

  it('responde 403 a un vendedor y 401 sin sesión', async () => {
    expect((await historyRoute(req(seller.token), undefined)).status).toBe(403)
    expect((await historyRoute(req(), undefined)).status).toBe(401)
  })
})
