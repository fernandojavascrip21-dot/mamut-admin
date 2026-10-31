import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as getSellerRoute } from '@api/sellers/[id]/route'
import { GET as listSellersRoute } from '@api/sellers/route'
import { db, sql } from '@db/client'
import { products, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { insertMovements, type NewStockMovement } from '@stock'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

// Productos de prueba con prefijo propio, para limpiarlos sin tocar el catálogo (como T-07).
const PREFIX = 'test-sellers-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

const req = (token?: string) =>
  new Request('http://api.test/api/sellers', {
    method: 'GET',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

// Los movimientos se borran del más nuevo al más viejo (el trigger revierte cada uno); después
// vendor_stock (ya en 0) y los productos. Va antes de cleanupTestData, porque vendor_stock
// apunta a los perfiles de prueba con FK `restrict`.
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

describe.skipIf(!hasServiceKey)('Mis vendedores (HU-09, con cuentas reales)', () => {
  let admin: TestUser
  let seller: TestUser
  let emptySeller: TestUser
  let inactiveSeller: TestUser
  let whey: number
  let creatine: number
  let returned: number

  const move = (rows: Omit<NewStockMovement, 'createdBy'>[]) =>
    withTransaction((tx) => insertMovements(tx, rows.map((row) => ({ ...row, createdBy: admin.id }))))

  // Entrega de bodega a vendedor: dos filas en la misma transacción (spec T-07 §3).
  const deliver = (productId: number, holder: string, qty: number) =>
    move([
      { productId, type: 'delivery', qty: -qty, holderProfileId: null },
      { productId, type: 'delivery', qty, holderProfileId: holder },
    ])

  const newProduct = async (label: string, image = '') => {
    const [product] = await db.insert(products)
      .values({ name: productName(label), price: '100', unitCost: '50', image }).returning()
    await move([{ productId: product!.id, type: 'initial', qty: 20, holderProfileId: null }])
    return product!.id
  }

  const list = async (token?: string) => listSellersRoute(req(token), undefined)
  const detail = async (id: string, token?: string) => getSellerRoute(req(token), ctx(id))

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    admin = await createTestUser('hu09-admin', { role: 'admin' })
    seller = await createTestUser('hu09-luis', { role: 'vendedor' })
    emptySeller = await createTestUser('hu09-sin-piezas', { role: 'vendedor' })
    inactiveSeller = await createTestUser('hu09-inactivo', { role: 'vendedor', active: false })

    whey = await newProduct('whey', 'https://example.com/whey.jpg')
    creatine = await newProduct('creatina')
    returned = await newProduct('devuelto')
    await deliver(whey, seller.id, 4)
    await deliver(creatine, seller.id, 2)
    // Entregado y retirado completo: queda una fila de vendor_stock con qty 0.
    await deliver(returned, seller.id, 3)
    await move([
      { productId: returned, type: 'return', qty: 3, holderProfileId: null },
      { productId: returned, type: 'return', qty: -3, holderProfileId: seller.id },
    ])
  }, 60_000)

  afterAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  it('lista a los vendedores activos con su total de piezas', async () => {
    const res = await list(admin.token)
    expect(res.status).toBe(200)
    const sellers: { id: string; fullName: string; units: number }[] = await res.json()

    expect(sellers.find((s) => s.id === seller.id)).toEqual({ id: seller.id, fullName: 'Prueba hu09-luis', units: 6 })
    expect(sellers.find((s) => s.id === emptySeller.id)?.units).toBe(0)
    expect(sellers.some((s) => s.id === inactiveSeller.id)).toBe(false)
    expect(sellers.some((s) => s.id === admin.id)).toBe(false)
  })

  it('el detalle trae sus datos y solo los productos con piezas', async () => {
    const res = await detail(seller.id, admin.token)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toMatchObject({ id: seller.id, fullName: 'Prueba hu09-luis', email: seller.email, phone: '5500000000', active: true, units: 6 })
    expect(body.stock).toHaveLength(2)
    expect(body.stock).toEqual(expect.arrayContaining([
      {
        productId: whey, name: expect.stringContaining('whey'), image: 'https://example.com/whey.jpg', units: 4,
        price: '100.00', unitCost: '50.0000', unitPrice: null, unitCostWithShipping: null,
      },
      {
        productId: creatine, name: expect.stringContaining('creatina'), image: null, units: 2,
        price: '100.00', unitCost: '50.0000', unitPrice: null, unitCostWithShipping: null,
      },
    ]))
  })

  it('el total del detalle coincide con el de la lista', async () => {
    const sellers: { id: string; units: number }[] = await (await list(admin.token)).json()
    const body = await (await detail(seller.id, admin.token)).json()
    expect(body.units).toBe(sellers.find((s) => s.id === seller.id)?.units)
  })

  it('un vendedor sin piezas tiene el stock vacío', async () => {
    const body = await (await detail(emptySeller.id, admin.token)).json()
    expect(body).toMatchObject({ units: 0, stock: [] })
  })

  it('responde 404 a un id inválido, inexistente, de administrador o de un vendedor desactivado', async () => {
    for (const id of ['no-es-uuid', '00000000-0000-4000-8000-000000000000', admin.id, inactiveSeller.id]) {
      expect((await detail(id, admin.token)).status, id).toBe(404)
    }
  })

  it('un vendedor recibe 403 y sin sesión es 401, en la lista y en el detalle', async () => {
    expect((await list(seller.token)).status).toBe(403)
    expect((await list()).status).toBe(401)
    expect((await detail(seller.id, seller.token)).status).toBe(403)
    expect((await detail(seller.id)).status).toBe(401)
  })
})
