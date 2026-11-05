import { randomUUID } from 'node:crypto'
import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getCashCut, resolveCutHolder, resolveCutPeriod } from '@cuts'
import { db, sql } from '@db/client'
import { directSales, products, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { createSale, getSale } from '@sales'
import { insertMovements, setHolderPrices } from '@stock'
import { cleanupSales, cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

// Productos de prueba con prefijo propio, para limpiarlos sin tocar el catálogo.
const PREFIX = 'test-cuts-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// Las ventas se borran primero (sus renglones apuntan a los productos con FK `restrict`); luego los
// movimientos del más nuevo al más viejo, vendor_stock y los productos.
async function cleanupStock() {
  await cleanupSales()
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

// México no tiene horario de verano: UTC-6 todo el año (spec T-20 §8).
describe('Corte: periodo (T-20)', () => {
  it('día: de 00:00 local a 00:00 del día siguiente', async () => {
    const period = await resolveCutPeriod('day', '2026-11-04')
    expect(period).toMatchObject({
      kind: 'day',
      from: '2026-11-04',
      to: '2026-11-04',
      timeZone: 'America/Mexico_City',
      startsAt: '2026-11-04T06:00:00.000Z',
      endsAt: '2026-11-05T06:00:00.000Z',
    })
  })

  it('semana: de lunes a domingo, con un domingo y un lunes como referencia', async () => {
    const sunday = await resolveCutPeriod('week', '2026-11-08')
    const monday = await resolveCutPeriod('week', '2026-11-09')
    expect([sunday.from, sunday.to]).toEqual(['2026-11-02', '2026-11-08'])
    expect(sunday.endsAt).toBe('2026-11-09T06:00:00.000Z')
    expect([monday.from, monday.to]).toEqual(['2026-11-09', '2026-11-15'])
  })

  it('mes: del 1 al último día, también en febrero y diciembre', async () => {
    const november = await resolveCutPeriod('month', '2026-11-15')
    const february = await resolveCutPeriod('month', '2028-02-10')
    const december = await resolveCutPeriod('month', '2026-12-31')
    expect([november.from, november.to]).toEqual(['2026-11-01', '2026-11-30'])
    expect([february.from, february.to]).toEqual(['2028-02-01', '2028-02-29'])
    expect([december.from, december.to]).toEqual(['2026-12-01', '2026-12-31'])
    expect(december.endsAt).toBe('2027-01-01T06:00:00.000Z')
  })

  it('sin date usa hoy en México: el periodo del día contiene el instante actual', async () => {
    const period = await resolveCutPeriod('day', undefined)
    const now = Date.now()
    expect(Date.parse(period.startsAt)).toBeLessThanOrEqual(now)
    expect(Date.parse(period.endsAt)).toBeGreaterThan(now)
  })

  it('rechaza un periodo o una fecha inválidos con 422', async () => {
    await expect(resolveCutPeriod('year', '2026-11-04')).rejects.toMatchObject({ status: 422 })
    for (const date of ['2026-13-01', '2026-02-30', '04/11/2026', '2026-1-4', '']) {
      await expect(resolveCutPeriod('day', date)).rejects.toMatchObject({ status: 422 })
    }
  })
})

describe.skipIf(!hasServiceKey)('Corte: titular y permisos (T-20, con cuentas reales)', () => {
  let admin: TestUser
  let seller: TestUser
  let otherSeller: TestUser
  let inactiveSeller: TestUser

  beforeAll(async () => {
    await cleanupTestData()
    admin = await createTestUser('t20-admin', { role: 'admin' })
    seller = await createTestUser('t20-luis', { role: 'vendedor' })
    otherSeller = await createTestUser('t20-otro', { role: 'vendedor' })
    inactiveSeller = await createTestUser('t20-inactivo', { role: 'vendedor', active: false })
  })

  afterAll(cleanupTestData)

  const asAdmin = () => ({ userId: admin.id, role: 'admin' })
  const asSeller = () => ({ userId: seller.id, role: 'vendedor' })

  it('el administrador sin holderId recibe la bodega (null)', async () => {
    expect(await resolveCutHolder(undefined, asAdmin())).toBeNull()
  })

  it('el administrador recibe a cualquier vendedor, también a uno desactivado', async () => {
    expect(await resolveCutHolder(seller.id, asAdmin())).toMatchObject({ id: seller.id })
    expect(await resolveCutHolder(inactiveSeller.id, asAdmin())).toMatchObject({ id: inactiveSeller.id })
  })

  it('un holderId que no es de un vendedor da 404', async () => {
    await expect(resolveCutHolder(admin.id, asAdmin())).rejects.toMatchObject({ status: 404 })
    await expect(resolveCutHolder(crypto.randomUUID(), asAdmin())).rejects.toMatchObject({ status: 404 })
  })

  it('el vendedor recibe su propio corte con o sin holderId', async () => {
    expect(await resolveCutHolder(undefined, asSeller())).toMatchObject({ id: seller.id })
    expect(await resolveCutHolder(seller.id, asSeller())).toMatchObject({ id: seller.id })
  })

  it('el vendedor que pide el corte de otro vendedor recibe 403', async () => {
    await expect(resolveCutHolder(otherSeller.id, asSeller())).rejects.toMatchObject({ status: 403 })
  })
})

describe.skipIf(!hasServiceKey)('Corte: totales y desglose (T-20, con cuentas reales)', () => {
  let admin: TestUser
  let seller: TestUser
  const asAdmin = () => ({ userId: admin.id, role: 'admin' })
  const asSeller = () => ({ userId: seller.id, role: 'vendedor' })

  // Producto con `qty` piezas ya en manos del vendedor, con precio y costo con envío propios.
  const productWithSeller = async (label: string, qty: number, unitPrice: string, unitCostWithShipping: string) => {
    const [product] = await db.insert(products)
      .values({ name: productName(label), price: '1', unitCost: '1' })
      .returning()
    const productId = product!.id
    await withTransaction(async (tx) => {
      await insertMovements(tx, [
        { productId, type: 'initial', qty, holderProfileId: null, createdBy: admin.id },
        { productId, type: 'delivery', qty: -qty, holderProfileId: null, createdBy: admin.id },
        { productId, type: 'delivery', qty, holderProfileId: seller.id, createdBy: admin.id },
      ])
      await setHolderPrices(tx, seller.id, productId, { unitPrice, unitCostWithShipping })
    })
    return productId
  }

  const sellAs = (actor: { userId: string; role: string }, productId: number, qty: number) =>
    createSale({ requestId: randomUUID(), holderId: seller.id, lines: [{ productId, qty }] }, actor)

  // Corte del día de hoy en México del vendedor, visto por el administrador.
  const todayCut = async () => {
    const { from } = await resolveCutPeriod('day', undefined)
    return getCashCut({ holderId: seller.id, period: 'day', date: from }, asAdmin())
  }

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    admin = await createTestUser('t20-sumas-admin', { role: 'admin' })
    seller = await createTestUser('t20-sumas-luis', { role: 'vendedor' })
  }, 60_000)

  afterAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('un periodo sin ventas devuelve ceros y listas vacías', async () => {
    const cut = await getCashCut({ holderId: seller.id, period: 'day', date: '2001-01-01' }, asAdmin())
    expect(cut.totals).toEqual({ salesCount: 0, units: 0, total: '0.00', cost: '0.00', profit: '0.00' })
    expect(cut.products).toEqual([])
  })

  it('cifras: 2 piezas a 920.00 con costo 700.0000 dan total 1840.00, costo 1400.00 y ganancia 440.00', async () => {
    const productId = await productWithSeller('cifras', 5, '920', '700')
    await sellAs({ userId: seller.id, role: 'vendedor' }, productId, 2)
    const cut = await todayCut()
    expect(cut.totals).toEqual({ salesCount: 1, units: 2, total: '1840.00', cost: '1400.00', profit: '440.00' })
    expect(cut.products).toEqual([
      { productId, name: expect.stringContaining('cifras'), image: null, unitPrice: '920.00', units: 2, total: '1840.00', cost: '1400.00', profit: '440.00' },
    ])
  })

  it('el costo de 4 decimales se redondea una sola vez: 3 piezas a 0.3335 dan 1.00', async () => {
    const productId = await productWithSeller('redondeo', 5, '2', '0.3335')
    await sellAs({ userId: seller.id, role: 'vendedor' }, productId, 3)
    const cut = await todayCut()
    const line = cut.products.find((product) => product.productId === productId)
    expect(line).toMatchObject({ total: '6.00', cost: '1.00', profit: '5.00' })
  })

  it('si el precio cambió dentro del periodo, el desglose trae un renglón por precio', async () => {
    const productId = await productWithSeller('dos-precios', 6, '100', '40')
    await sellAs({ userId: seller.id, role: 'vendedor' }, productId, 1)
    await withTransaction((tx) => setHolderPrices(tx, seller.id, productId, { unitPrice: '120', unitCostWithShipping: '40' }))
    await sellAs({ userId: seller.id, role: 'vendedor' }, productId, 2)
    const cut = await todayCut()
    const lines = cut.products.filter((product) => product.productId === productId)
    expect(lines.map((line) => [line.unitPrice, line.units, line.total]).sort()).toEqual([
      ['100.00', 1, '100.00'],
      ['120.00', 2, '240.00'],
    ])
  })

  it('una venta anulada no cuenta en totales ni desglose', async () => {
    const productId = await productWithSeller('anulada', 3, '50', '10')
    const { sale } = await sellAs({ userId: seller.id, role: 'vendedor' }, productId, 1)
    const before = await todayCut()
    await db.update(directSales).set({ voidedAt: new Date().toISOString() }).where(eq(directSales.id, sale.id))
    const after = await todayCut()
    expect(after.totals.salesCount).toBe(before.totals.salesCount - 1)
    expect(after.products.some((product) => product.productId === productId)).toBe(false)
  })

  it('lista de ventas: la más reciente primero, con renglones, quién vendió y la marca del administrador', async () => {
    const productId = await productWithSeller('lista', 6, '920', '700.3335')
    const mine = await sellAs(asSeller(), productId, 1)
    const byAdmin = await sellAs(asAdmin(), productId, 2)
    const cut = await todayCut()
    const [first, second] = cut.sales.filter((sale) => sale.lines.some((line) => line.productId === productId))
    expect(first).toMatchObject({
      requestId: byAdmin.sale.requestId,
      registeredByAdmin: true,
      soldBy: { id: admin.id },
      total: '1840.00',
      lines: [{ productId, qty: 2, unitPrice: '920.00', subtotal: '1840.00', unitCost: '700.3335' }],
    })
    expect(second).toMatchObject({ requestId: mine.sale.requestId, registeredByAdmin: false, soldBy: { id: seller.id } })
    expect(Date.parse(first!.soldAt)).toBeGreaterThanOrEqual(Date.parse(second!.soldAt))
  })

  it('total y ganancia de cada venta y renglón coinciden con la regla de T-18 (getSale)', async () => {
    const productId = await productWithSeller('regla-t18', 6, '10', '3.3335')
    const { sale } = await sellAs(asSeller(), productId, 3)
    const detail = await getSale(sale.requestId, asAdmin())
    const listed = (await todayCut()).sales.find((item) => item.requestId === sale.requestId)
    expect(listed).toMatchObject({ total: detail.total, profit: detail.profit })
    expect(listed!.lines[0]).toMatchObject({ subtotal: detail.lines[0]!.subtotal, profit: detail.lines[0]!.profit })
  })

  it('una venta anulada tampoco sale en la lista', async () => {
    const productId = await productWithSeller('anulada-lista', 3, '50', '10')
    const { sale } = await sellAs(asSeller(), productId, 1)
    await db.update(directSales).set({ voidedAt: new Date().toISOString() }).where(eq(directSales.id, sale.id))
    const cut = await todayCut()
    expect(cut.sales.some((item) => item.requestId === sale.requestId)).toBe(false)
  })

  it('el vendedor recibe el corte sin costo ni ganancia en ningún nivel', async () => {
    const { from } = await resolveCutPeriod('day', undefined)
    const cut = await getCashCut({ holderId: undefined, period: 'day', date: from }, asSeller())
    expect(cut.totals.salesCount).toBeGreaterThan(0)
    const keys = JSON.stringify(cut)
    expect(keys).not.toMatch(/"(cost|unitCost|profit)"/)
  })
})
