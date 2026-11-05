import { randomUUID } from 'node:crypto'
import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as cutsRoute } from '@api/cuts/route'
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

  // Producto con `qty` piezas en la bodega.
  const newWarehouseProduct = async (label: string, qty: number) => {
    const [product] = await db.insert(products).values({ name: productName(label), price: '50', unitCost: '20' }).returning()
    await withTransaction((tx) => insertMovements(tx, [
      { productId: product!.id, type: 'initial', qty, holderProfileId: null, createdBy: admin.id },
    ]))
    return product!.id
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

  // Vende una pieza y fija `sold_at` a un instante exacto (UTC); México es UTC-6 todo el año.
  const sellAt = async (productId: number, soldAtUtc: string) => {
    const { sale } = await sellAs(asSeller(), productId, 1)
    await db.update(directSales).set({ soldAt: soldAtUtc }).where(eq(directSales.id, sale.id))
    return sale.requestId
  }
  const idsOf = async (period: 'day' | 'week' | 'month', date: string) =>
    (await getCashCut({ holderId: seller.id, period, date }, asAdmin())).sales.map((sale) => sale.requestId)

  it('día: 23:59:59 hora de México cae en ese día y 00:00:00 del siguiente, no', async () => {
    const productId = await productWithSeller('borde-dia', 4, '10', '4')
    const late = await sellAt(productId, '2026-03-04T05:59:59Z') // 3 mar 23:59:59 local
    const early = await sellAt(productId, '2026-03-04T06:00:00Z') // 4 mar 00:00:00 local
    expect(await idsOf('day', '2026-03-03')).toEqual([late])
    expect(await idsOf('day', '2026-03-04')).toEqual([early])
  })

  it('semana: el domingo cae en la semana del lunes anterior y el lunes siguiente, no', async () => {
    const productId = await productWithSeller('borde-semana', 4, '10', '4')
    const sunday = await sellAt(productId, '2027-03-08T05:59:59Z') // dom 7 mar 2027 23:59:59 local
    const monday = await sellAt(productId, '2027-03-08T06:00:00Z') // lun 8 mar 2027 00:00:00 local
    expect(await idsOf('week', '2027-03-03')).toEqual([sunday])
    expect(await idsOf('week', '2027-03-07')).toEqual([sunday])
    expect(await idsOf('week', '2027-03-08')).toEqual([monday])
  })

  it('mes: las ventas del 31 no entran al mes siguiente y viceversa', async () => {
    const productId = await productWithSeller('borde-mes', 4, '10', '4')
    const lastOfAugust = await sellAt(productId, '2027-09-01T05:59:59Z') // 31 ago 2027 23:59:59 local
    const firstOfSeptember = await sellAt(productId, '2027-09-01T06:00:00Z') // 1 sep 2027 00:00:00 local
    expect(await idsOf('month', '2027-08-15')).toEqual([lastOfAugust])
    expect(await idsOf('month', '2027-09-15')).toEqual([firstOfSeptember])
  })

  it('un periodo futuro devuelve un corte vacío', async () => {
    const cut = await getCashCut({ holderId: seller.id, period: 'month', date: '2099-01-01' }, asAdmin())
    expect(cut.totals).toMatchObject({ salesCount: 0, units: 0, total: '0.00' })
    expect(cut.sales).toEqual([])
  })

  it('bodega: solo cuenta ventas de titular null, y las de un vendedor no entran', async () => {
    const warehouseProduct = await newWarehouseProduct('bodega', 4)
    const sellerProduct = await productWithSeller('bodega-vendedor', 4, '10', '4')
    const own = await createSale({ requestId: randomUUID(), holderId: null, lines: [{ productId: warehouseProduct, qty: 2 }] }, asAdmin())
    const theirs = await sellAs(asSeller(), sellerProduct, 1)
    // 2031 queda lejos de cualquier dato real de la base.
    await db.update(directSales).set({ soldAt: '2031-06-15T18:00:00Z' }).where(eq(directSales.requestId, own.sale.requestId))
    await db.update(directSales).set({ soldAt: '2031-06-15T18:00:00Z' }).where(eq(directSales.requestId, theirs.sale.requestId))
    const cut = await getCashCut({ holderId: undefined, period: 'day', date: '2031-06-15' }, asAdmin())
    expect(cut.holder).toBeNull()
    const mine = cut.sales.filter((sale) => sale.soldBy.id === admin.id)
    expect(mine.map((sale) => [sale.requestId, sale.registeredByAdmin])).toEqual([[own.sale.requestId, false]])
    expect(cut.sales.some((sale) => sale.requestId === theirs.sale.requestId)).toBe(false)
  })

  it('el vendedor recibe costo y ganancia calculados con su precio y su costo con envío', async () => {
    const productId = await productWithSeller('vendedor-ve', 5, '920', '700')
    const { sale } = await sellAs(asSeller(), productId, 2)
    const { from } = await resolveCutPeriod('day', undefined)
    const cut = await getCashCut({ holderId: undefined, period: 'day', date: from }, asSeller())
    // El seller de este bloque acumula ventas de otras pruebas del mismo día: se revisa la de este producto.
    expect(cut.totals.cost).toEqual(expect.any(String))
    expect(cut.totals.profit).toEqual(expect.any(String))
    expect(cut.products.find((line) => line.productId === productId))
      .toMatchObject({ unitPrice: '920.00', total: '1840.00', cost: '1400.00', profit: '440.00' })
    const mine = cut.sales.find((item) => item.requestId === sale.requestId)
    expect(mine).toMatchObject({ total: '1840.00', profit: '440.00' })
    expect(mine!.lines[0]).toMatchObject({ unitCost: '700.0000', profit: '440.00' })
  })

  it('el vendedor y el administrador reciben cifras idénticas para el mismo titular y periodo', async () => {
    const productId = await productWithSeller('mismas-cifras', 3, '50', '20')
    await sellAs(asSeller(), productId, 1)
    const { from } = await resolveCutPeriod('day', undefined)
    const bySeller = await getCashCut({ holderId: undefined, period: 'day', date: from }, asSeller())
    const byAdmin = await getCashCut({ holderId: seller.id, period: 'day', date: from }, asAdmin())
    expect(bySeller).toEqual(byAdmin)
  })

  it('tras cambiar el precio con otra entrega, las ventas viejas conservan su precio', async () => {
    const productId = await productWithSeller('cambio-precio', 6, '100', '40')
    await sellAs(asSeller(), productId, 1)
    await withTransaction((tx) => setHolderPrices(tx, seller.id, productId, { unitPrice: '150', unitCostWithShipping: '60' }))
    await sellAs(asSeller(), productId, 1)
    const cut = await todayCut()
    const lines = cut.products.filter((line) => line.productId === productId)
    expect(lines.map((line) => [line.unitPrice, line.units, line.profit]).sort()).toEqual([
      ['100.00', 1, '60.00'],
      ['150.00', 1, '90.00'],
    ])
  })

  it('sin precio propio, subir el precio general afecta la venta nueva y no la anterior', async () => {
    const [product] = await db.insert(products).values({ name: productName('general-sube'), price: '80', unitCost: '30' }).returning()
    const productId = product!.id
    await withTransaction((tx) => insertMovements(tx, [
      { productId, type: 'initial', qty: 4, holderProfileId: null, createdBy: admin.id },
      { productId, type: 'delivery', qty: -4, holderProfileId: null, createdBy: admin.id },
      { productId, type: 'delivery', qty: 4, holderProfileId: seller.id, createdBy: admin.id },
    ]))
    await sellAs(asSeller(), productId, 1)
    await db.update(products).set({ price: '90' }).where(eq(products.id, productId))
    await sellAs(asSeller(), productId, 1)
    const lines = (await todayCut()).products.filter((line) => line.productId === productId)
    expect(lines.map((line) => [line.unitPrice, line.units]).sort()).toEqual([['80.00', 1], ['90.00', 1]])
  })

  it('con precio propio, subir el general no cambia el precio de la venta nueva', async () => {
    const productId = await productWithSeller('propio-fijo', 4, '120', '50')
    await db.update(products).set({ price: '999' }).where(eq(products.id, productId))
    await sellAs(asSeller(), productId, 1)
    const lines = (await todayCut()).products.filter((line) => line.productId === productId)
    expect(lines.map((line) => line.unitPrice)).toEqual(['120.00'])
  })
})

describe.skipIf(!hasServiceKey)('Corte: GET /api/cuts (T-20, con cuentas reales)', () => {
  let admin: TestUser
  let seller: TestUser
  let otherSeller: TestUser
  let inactiveSeller: TestUser

  const getCut = (token: string | undefined, query = '') =>
    cutsRoute(new Request(`http://api.test/api/cuts${query}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }), undefined)

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    admin = await createTestUser('t20-ruta-admin', { role: 'admin' })
    seller = await createTestUser('t20-ruta-luis', { role: 'vendedor' })
    otherSeller = await createTestUser('t20-ruta-otro', { role: 'vendedor' })
    inactiveSeller = await createTestUser('t20-ruta-inactivo', { role: 'vendedor', active: false })
  }, 60_000)

  afterAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('sin sesión da 401 y una cuenta desactivada no pasa', async () => {
    expect((await getCut(undefined)).status).toBe(401)
    expect((await getCut(inactiveSeller.token)).status).toBeGreaterThanOrEqual(401)
    expect((await getCut(inactiveSeller.token)).status).toBeLessThanOrEqual(403)
  })

  it('administrador con holderId y period=week recibe 200 con la semana de lunes a domingo', async () => {
    const res = await getCut(admin.token, `?holderId=${seller.id}&period=week&date=2026-11-04`)
    expect(res.status).toBe(200)
    const { cut } = await res.json()
    expect(cut.holder).toMatchObject({ id: seller.id })
    expect(cut.period).toEqual({ kind: 'week', from: '2026-11-02', to: '2026-11-08', timeZone: 'America/Mexico_City' })
    expect(cut.totals).toMatchObject({ salesCount: 0, total: '0.00' })
    expect(cut.products).toEqual([])
    expect(cut.sales).toEqual([])
  })

  it('administrador sin holderId recibe la bodega; period por defecto es day', async () => {
    const { cut } = await (await getCut(admin.token)).json()
    expect(cut.holder).toBeNull()
    expect(cut.period.kind).toBe('day')
    expect(cut.period.from).toBe(cut.period.to)
  })

  it('administrador pide un vendedor desactivado: 200; un id que no es de vendedor: 404', async () => {
    expect((await getCut(admin.token, `?holderId=${inactiveSeller.id}`)).status).toBe(200)
    expect((await getCut(admin.token, `?holderId=${admin.id}`)).status).toBe(404)
  })

  it('vendedor: su corte sin holderId trae costo y ganancia; el de otro o el de la bodega, 403', async () => {
    const own = await getCut(seller.token)
    expect(own.status).toBe(200)
    const { cut } = await own.json()
    expect(cut.totals).toHaveProperty('cost')
    expect(cut.totals).toHaveProperty('profit')
    expect((await getCut(seller.token, `?holderId=${otherSeller.id}`)).status).toBe(403)
    expect((await getCut(seller.token, `?holderId=${admin.id}`)).status).toBe(403)
  })

  it('parámetros inválidos dan 422', async () => {
    for (const query of ['?period=year', '?date=2026-13-01', '?date=2026-02-30', '?date=04/11/2026', '?holderId=no-es-uuid']) {
      expect((await getCut(admin.token, query)).status, query).toBe(422)
    }
  })
})
