import { randomUUID } from 'node:crypto'
import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as cutsRoute } from '@api/cuts/route'
import { getBusinessCut, getHomeCut, parseCutScope } from '@cuts'
import { db, sql } from '@db/client'
import { directSales, products, profiles, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { fromMinorUnits, toMinorUnits } from '@lib/money'
import { createSale } from '@sales'
import { insertMovements, setHolderPrices } from '@stock'
import { cleanupSales, cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

// Productos de prueba con prefijo propio, para limpiarlos sin tocar el catálogo.
const PREFIX = 'test-business-cut-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// Cifras de dinero de los totales y de cada renglón del resumen.
const MONEY_KEYS = ['total', 'factoryCost', 'realProfit', 'shippingCover'] as const

// Totales en cero de un periodo sin ventas.
const ZERO_TOTALS = {
  salesCount: 0, units: 0, total: '0.00', factoryCost: '0.00', realProfit: '0.00', shippingCover: '0.00',
}

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

// Suma en centavos, sin flotantes, de una cifra de dinero de varios renglones.
const sumMoney = (rows: Record<string, unknown>[], key: string) =>
  fromMinorUnits(rows.reduce((acc, row) => acc + toMinorUnits(String(row[key]), 2), 0), 2)

// Las cifras de un renglón sin el titular, para compararlas con los totales de su corte para casa.
const figuresOf = (row: Record<string, unknown>) => {
  const { holder: _holder, ...figures } = row
  return figures
}

describe('parseCutScope (HU-22)', () => {
  it('acepta holder y business', () => {
    expect(parseCutScope('holder')).toBe('holder')
    expect(parseCutScope('business')).toBe('business')
  })

  it('rechaza otro alcance con 422 y el mensaje del spec', () => {
    expect(() => parseCutScope('otro')).toThrow(expect.objectContaining({
      status: 422, message: 'El alcance del corte debe ser holder o business',
    }))
  })
})

describe.skipIf(!hasServiceKey)('Resumen del negocio en el corte para casa (HU-22, con cuentas reales)', () => {
  let admin: TestUser
  let seller: TestUser
  let anaSeller: TestUser
  let carlaSeller: TestUser
  let inactiveSeller: TestUser
  const asAdmin = () => ({ userId: admin.id, role: 'admin' })
  const asSeller = () => ({ userId: seller.id, role: 'vendedor' })

  // Producto con costo de fábrica `unitCost` y `qty` piezas en manos de `holderId`, con costo con
  // envío propio (`null` = sin él: el vendedor vende al costo de fábrica).
  const productWithSeller = async (
    label: string, holderId: string, qty: number, price: string, unitCost: string, unitCostWithShipping: string | null,
  ) => {
    const [product] = await db.insert(products).values({ name: productName(label), price, unitCost }).returning()
    const productId = product!.id
    await withTransaction(async (tx) => {
      await insertMovements(tx, [
        { productId, type: 'initial', qty, holderProfileId: null, createdBy: admin.id },
        { productId, type: 'delivery', qty: -qty, holderProfileId: null, createdBy: admin.id },
        { productId, type: 'delivery', qty, holderProfileId: holderId, createdBy: admin.id },
      ])
      await setHolderPrices(tx, holderId, productId, { unitPrice: null, unitCostWithShipping })
    })
    return productId
  }

  // Producto con `qty` piezas en la bodega.
  const warehouseProduct = async (label: string, qty: number, price: string, unitCost: string) => {
    const [product] = await db.insert(products).values({ name: productName(label), price, unitCost }).returning()
    await withTransaction((tx) => insertMovements(tx, [
      { productId: product!.id, type: 'initial', qty, holderProfileId: null, createdBy: admin.id },
    ]))
    return product!.id
  }

  // Registra una venta (el administrador, desde el stock de `holderId`) y fija su `sold_at` al
  // mediodía (hora de México, UTC-6) de `date`. Cada caso usa un día propio de 2018, para que el
  // resumen del negocio solo vea sus ventas.
  const sellOn = async (date: string, holderId: string | null, lines: { productId: number; qty: number }[]) => {
    const { sale } = await createSale({ requestId: randomUUID(), holderId, lines }, asAdmin())
    await db.update(directSales).set({ soldAt: `${date}T18:00:00Z` }).where(eq(directSales.id, sale.id))
    return sale
  }

  const businessCutOn = (date: string) => getBusinessCut({ period: 'day', date }, asAdmin())

  const getCut = (token: string, query: string) =>
    cutsRoute(new Request(`http://api.test/api/cuts${query}`, { headers: { authorization: `Bearer ${token}` } }), undefined)

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    admin = await createTestUser('hu22-admin', { role: 'admin' })
    seller = await createTestUser('hu22-luis', { role: 'vendedor' })
    anaSeller = await createTestUser('hu22-ana', { role: 'vendedor' })
    carlaSeller = await createTestUser('hu22-carla', { role: 'vendedor' })
    inactiveSeller = await createTestUser('hu22-inactivo', { role: 'vendedor' })
  }, 60_000)

  afterAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('bodega $500 y vendedor $1,840 el mismo día dan un vendido de 2340.00 y los renglones suman los totales', async () => {
    const date = '2018-05-01'
    const warehouse = await warehouseProduct('cuadre-bodega', 5, '250', '156.25')
    const held = await productWithSeller('cuadre-luis', seller.id, 5, '920', '600', '700')
    await sellOn(date, null, [{ productId: warehouse, qty: 2 }])
    await sellOn(date, seller.id, [{ productId: held, qty: 2 }])

    const cut = await businessCutOn(date)
    expect(cut.totals).toEqual({
      salesCount: 2, units: 4, total: '2340.00', factoryCost: '1512.50', realProfit: '827.50', shippingCover: '200.00',
    })
    expect(cut.holders).toHaveLength(2)
    for (const key of MONEY_KEYS) {
      expect(sumMoney(cut.holders, key)).toBe(cut.totals[key])
    }
    expect(cut.holders.reduce((acc, row) => acc + row.salesCount, 0)).toBe(cut.totals.salesCount)
    expect(cut.holders.reduce((acc, row) => acc + row.units, 0)).toBe(cut.totals.units)
  })

  it('con costos de 4 decimales en varios titulares los totales cuadran al centavo con los renglones', async () => {
    const date = '2018-05-02'
    const warehouse = await warehouseProduct('cuatro-bodega', 5, '1', '0.0050')
    const held = await productWithSeller('cuatro-luis', seller.id, 5, '1', '0.0050', null)
    const mixed = await productWithSeller('cuatro-ana', anaSeller.id, 5, '2', '0.3335', '0.5001')
    await sellOn(date, null, [{ productId: warehouse, qty: 1 }])
    await sellOn(date, seller.id, [{ productId: held, qty: 1 }])
    await sellOn(date, anaSeller.id, [{ productId: mixed, qty: 1 }])
    await sellOn(date, anaSeller.id, [{ productId: mixed, qty: 2 }])

    const cut = await businessCutOn(date)
    // Cada titular redondea su costo de fábrica una vez (0.005 → 0.01); el negocio suma esas cifras.
    expect(cut.holders.find((row) => row.holder === null)).toMatchObject({ factoryCost: '0.01' })
    expect(cut.holders.find((row) => row.holder?.id === seller.id)).toMatchObject({ factoryCost: '0.01' })
    expect(cut.holders.find((row) => row.holder?.id === anaSeller.id)).toMatchObject({ factoryCost: '1.00' })
    expect(cut.totals).toMatchObject({ salesCount: 4, units: 5, total: '8.00', factoryCost: '1.02', realProfit: '6.98' })
    for (const key of MONEY_KEYS) {
      expect(sumMoney(cut.holders, key)).toBe(cut.totals[key])
    }
  })

  it('cada renglón es igual a los totales del corte para casa de su titular', async () => {
    const date = '2018-05-03'
    const warehouse = await warehouseProduct('igual-bodega', 6, '333.33', '111.1111')
    const held = await productWithSeller('igual-luis', seller.id, 6, '920', '600.3335', '700.5555')
    const other = await productWithSeller('igual-ana', anaSeller.id, 6, '150', '99.9999', null)
    await sellOn(date, null, [{ productId: warehouse, qty: 3 }])
    await sellOn(date, seller.id, [{ productId: held, qty: 1 }])
    await sellOn(date, seller.id, [{ productId: held, qty: 2 }])
    await sellOn(date, anaSeller.id, [{ productId: other, qty: 1 }])

    const cut = await businessCutOn(date)
    expect(cut.holders).toHaveLength(3)
    for (const row of cut.holders) {
      const home = await getHomeCut({ holderId: row.holder?.id, period: 'day', date }, asAdmin())
      expect(figuresOf(row)).toEqual(home.totals)
    }
  })

  it('un vendedor desactivado con ventas aparece con active false y cuenta en el total', async () => {
    const date = '2018-05-04'
    const held = await productWithSeller('inactivo', inactiveSeller.id, 5, '400', '250', null)
    await sellOn(date, inactiveSeller.id, [{ productId: held, qty: 1 }])
    await db.update(profiles).set({ active: false }).where(eq(profiles.id, inactiveSeller.id))

    const cut = await businessCutOn(date)
    expect(cut.holders).toEqual([
      expect.objectContaining({
        holder: { id: inactiveSeller.id, fullName: 'Prueba hu22-inactivo', active: false },
        salesCount: 1, units: 1, total: '400.00',
      }),
    ])
    expect(cut.totals).toMatchObject({ salesCount: 1, units: 1, total: '400.00', realProfit: '150.00' })
  })

  it('ordena la bodega primero, luego los vendedores por vendido descendente y en empate por nombre', async () => {
    const date = '2018-05-05'
    const warehouse = await warehouseProduct('orden-bodega', 5, '10', '5')
    const luis = await productWithSeller('orden-luis', seller.id, 5, '300', '100', null)
    const carla = await productWithSeller('orden-carla', carlaSeller.id, 5, '50', '20', null)
    const ana = await productWithSeller('orden-ana', anaSeller.id, 5, '50', '20', null)
    await sellOn(date, carlaSeller.id, [{ productId: carla, qty: 1 }])
    await sellOn(date, null, [{ productId: warehouse, qty: 1 }])
    await sellOn(date, anaSeller.id, [{ productId: ana, qty: 1 }])
    await sellOn(date, seller.id, [{ productId: luis, qty: 1 }])

    const cut = await businessCutOn(date)
    expect(cut.holders.map((row) => row.holder?.id ?? null)).toEqual([null, seller.id, anaSeller.id, carlaSeller.id])
  })

  it('no cuenta las ventas anuladas ni las de fuera del periodo', async () => {
    const date = '2018-05-06'
    const warehouse = await warehouseProduct('anuladas-bodega', 6, '100', '40')
    const held = await productWithSeller('anuladas-luis', seller.id, 6, '200', '80', null)
    await sellOn(date, null, [{ productId: warehouse, qty: 1 }])
    const voided = await sellOn(date, seller.id, [{ productId: held, qty: 1 }])
    await db.update(directSales).set({ voidedAt: new Date().toISOString() }).where(eq(directSales.id, voided.id))
    await sellOn('2018-05-07', seller.id, [{ productId: held, qty: 2 }])
    await sellOn('2018-05-08', null, [{ productId: warehouse, qty: 1 }])

    const cut = await businessCutOn(date)
    expect(cut.holders.map((row) => row.holder?.id ?? null)).toEqual([null])
    expect(cut.totals).toEqual({
      salesCount: 1, units: 1, total: '100.00', factoryCost: '40.00', realProfit: '60.00', shippingCover: '0.00',
    })
  })

  it('un periodo sin ventas da totales en cero y holders vacío', async () => {
    const cut = await businessCutOn('2018-06-01')
    expect(cut.totals).toEqual(ZERO_TOTALS)
    expect(cut.holders).toEqual([])
  })

  it('responde con type home, scope business, holder null y el periodo', async () => {
    const date = '2018-06-02'
    const cut = await getBusinessCut({ period: 'week', date }, asAdmin())
    expect(cut).toMatchObject({
      type: 'home',
      scope: 'business',
      holder: null,
      period: { kind: 'week', from: '2018-05-28', to: '2018-06-03', timeZone: 'America/Mexico_City' },
    })
  })

  it('getBusinessCut rechaza a un vendedor con 403', async () => {
    await expect(getBusinessCut({ period: 'day', date: '2018-05-01' }, asSeller()))
      .rejects.toMatchObject({ status: 403 })
  })

  it('GET /api/cuts?type=home&scope=business: 200 con el resumen del negocio', async () => {
    const res = await getCut(admin.token, '?type=home&scope=business&period=day&date=2018-05-01')
    expect(res.status).toBe(200)
    const { cut } = await res.json()
    expect(cut).toMatchObject({
      type: 'home',
      scope: 'business',
      holder: null,
      period: { kind: 'day', from: '2018-05-01', to: '2018-05-01', timeZone: 'America/Mexico_City' },
      totals: { total: '2340.00' },
    })
    expect(cut.holders).toHaveLength(2)
  })

  it('GET /api/cuts: el vendedor recibe 403 con type=home&scope=business', async () => {
    expect((await getCut(seller.token, '?type=home&scope=business')).status).toBe(403)
  })

  it('GET /api/cuts: scope inválido da 422', async () => {
    const res = await getCut(admin.token, '?type=home&scope=otro')
    expect(res.status).toBe(422)
    expect((await res.json()).error.message).toBe('El alcance del corte debe ser holder o business')
  })

  it('GET /api/cuts: scope=business sin type=home da 422', async () => {
    const res = await getCut(admin.token, '?scope=business')
    expect(res.status).toBe(422)
    expect((await res.json()).error.message).toBe('El resumen del negocio solo existe en el corte para casa')
  })

  it('GET /api/cuts: scope=business con holderId da 422', async () => {
    const res = await getCut(admin.token, `?type=home&scope=business&holderId=${seller.id}`)
    expect(res.status).toBe(422)
    expect((await res.json()).error.message).toBe('El resumen del negocio no lleva holderId')
  })

  it('GET /api/cuts: scope=holder explícito responde igual que sin scope', async () => {
    const query = `?type=home&holderId=${seller.id}&period=day&date=2018-05-01`
    const withScope = await getCut(admin.token, `${query}&scope=holder`)
    const withoutScope = await getCut(admin.token, query)
    expect(withScope.status).toBe(200)
    expect(await withScope.json()).toEqual(await withoutScope.json())
  })
})
