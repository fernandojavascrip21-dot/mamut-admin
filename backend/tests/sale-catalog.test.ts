import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as catalogRoute } from '@api/sales/catalog/route'
import { db, sql } from '@db/client'
import { products, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { insertMovements, setHolderPrices, type NewStockMovement } from '@stock'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

// Productos de prueba con prefijo propio, para limpiarlos sin tocar el catálogo.
const PREFIX = 'test-sale-catalog-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

const req = (token?: string, query = '') =>
  new Request(`http://api.test/api/sales/catalog${query}`, { method: 'GET', headers: token ? { authorization: `Bearer ${token}` } : {} })

interface CatalogBody {
  holder: { id: string; fullName: string } | null
  products: { productId: number; name: string; image: string | null; units: number; price: string; unitCost: string }[]
}

// Los movimientos se borran del más nuevo al más viejo (el trigger revierte cada uno); después
// vendor_stock y los productos. Va antes de cleanupTestData: vendor_stock apunta a los perfiles de prueba.
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

describe.skipIf(!hasServiceKey)('Catálogo de venta por titular (HU-17, con cuentas reales)', () => {
  let admin: TestUser
  let seller: TestUser
  let inactiveSeller: TestUser
  let own: number
  let general: number
  let soldOut: number
  let warehouseOnly: number
  let archived: number

  const move = (rows: Omit<NewStockMovement, 'createdBy'>[]) =>
    withTransaction((tx) => insertMovements(tx, rows.map((row) => ({ ...row, createdBy: admin.id }))))

  const deliver = (productId: number, holder: string, qty: number) =>
    move([
      { productId, type: 'delivery', qty: -qty, holderProfileId: null },
      { productId, type: 'delivery', qty, holderProfileId: holder },
    ])

  const newProduct = async (label: string, opts: { initial: number; archived?: boolean; price?: string; unitCost?: string; image?: string }) => {
    const [product] = await db.insert(products)
      .values({
        name: productName(label),
        price: opts.price ?? '480',
        unitCost: opts.unitCost ?? '200',
        image: opts.image ?? '',
        active: !opts.archived,
      })
      .returning()
    await move([{ productId: product!.id, type: 'initial', qty: opts.initial, holderProfileId: null }])
    return product!.id
  }

  const catalog = async (query = ''): Promise<CatalogBody> => {
    const res = await catalogRoute(req(admin.token, query), undefined)
    expect(res.status).toBe(200)
    return res.json()
  }

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    admin = await createTestUser('hu17-admin', { role: 'admin' })
    seller = await createTestUser('hu17-victor', { role: 'vendedor' })
    inactiveSeller = await createTestUser('hu17-inactivo', { role: 'vendedor', active: false })

    // Con precio propio y costo con envío; la bodega conserva 4.
    own = await newProduct('propio', { initial: 10, price: '471', unitCost: '205.5', image: 'https://example.com/propio.jpg' })
    await deliver(own, seller.id, 6)
    await withTransaction((tx) => setHolderPrices(tx, seller.id, own, { unitPrice: '500', unitCostWithShipping: '310.1234' }))
    // Sin precio ni costo propios: usa los generales.
    general = await newProduct('general', { initial: 5, price: '350', unitCost: '120' })
    await deliver(general, seller.id, 2)
    // Se le acabó (qty 0): sigue en su catálogo.
    soldOut = await newProduct('agotado', { initial: 3 })
    await deliver(soldOut, seller.id, 3)
    await move([
      { productId: soldOut, type: 'return', qty: 3, holderProfileId: null },
      { productId: soldOut, type: 'return', qty: -3, holderProfileId: seller.id },
    ])
    warehouseOnly = await newProduct('bodega', { initial: 7 })
    archived = await newProduct('archivado', { initial: 2, archived: true })
  }, 60_000)

  afterAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  describe('bodega', () => {
    it('lista los productos activos con units = stock, precio general y costo de fábrica', async () => {
      const body = await catalog()
      expect(body.holder).toBeNull()
      expect(body.products.find((p) => p.productId === own)).toEqual({
        productId: own,
        name: expect.stringContaining('propio'),
        image: 'https://example.com/propio.jpg',
        units: 4,
        price: '471.00',
        unitCost: '205.5000',
      })
      expect(body.products.find((p) => p.productId === warehouseOnly)).toMatchObject({ units: 7, image: null })
    })

    it('un holderId vacío también es la bodega', async () => {
      expect((await catalog('?holderId=')).holder).toBeNull()
    })

    it('no incluye productos archivados y sale por nombre', async () => {
      const body = await catalog()
      expect(body.products.some((p) => p.productId === archived)).toBe(false)
      const names = body.products.map((p) => p.name)
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    })
  })

  describe('vendedor', () => {
    it('devuelve su titular, sus piezas, su precio propio y su costo con envío', async () => {
      const body = await catalog(`?holderId=${seller.id}`)
      expect(body.holder).toEqual({ id: seller.id, fullName: expect.stringContaining('hu17-victor') })
      expect(body.products.find((p) => p.productId === own)).toMatchObject({
        units: 6,
        price: '500.00',
        unitCost: '310.1234',
      })
    })

    it('sin precio ni costo propios usa los generales', async () => {
      const body = await catalog(`?holderId=${seller.id}`)
      expect(body.products.find((p) => p.productId === general)).toMatchObject({
        units: 2,
        price: '350.00',
        unitCost: '120.0000',
      })
    })

    it('incluye lo que tuvo y se le acabó, con units 0', async () => {
      const body = await catalog(`?holderId=${seller.id}`)
      expect(body.products.find((p) => p.productId === soldOut)).toMatchObject({ units: 0 })
    })

    it('no incluye lo que nunca tuvo', async () => {
      const body = await catalog(`?holderId=${seller.id}`)
      expect(body.products.some((p) => p.productId === warehouseOnly)).toBe(false)
    })
  })

  describe('errores', () => {
    it('401 sin sesión y 403 a un vendedor', async () => {
      expect((await catalogRoute(req(), undefined)).status).toBe(401)
      expect((await catalogRoute(req(seller.token), undefined)).status).toBe(403)
    })

    it('422 con un holderId que no es UUID', async () => {
      const res = await catalogRoute(req(admin.token, '?holderId=abc'), undefined)
      expect(res.status).toBe(422)
    })

    it('404 con un vendedor inactivo o inexistente', async () => {
      expect((await catalogRoute(req(admin.token, `?holderId=${inactiveSeller.id}`), undefined)).status).toBe(404)
      expect((await catalogRoute(req(admin.token, `?holderId=${randomUUID()}`), undefined)).status).toBe(404)
    })
  })
})
