import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, sql } from '@db/client'
import { isCheckViolation } from '@db/errors'
import { products, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { createDelivery } from '@deliveries'
import { createProduct } from '@products'
import { createReturn } from '@returns'
import { createShrinkage, getShrinkage, MAX_QTY, type CreateShrinkageInput } from '@shrinkage'
import { insertMovements } from '@stock'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-shr-'
const productName = () => `${PREFIX}${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// Movimientos del más nuevo al más viejo (revierten saldos), las filas de vendor_stock que quedan en 0
// y luego los productos de prueba.
async function cleanupShrinkage() {
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

describe.skipIf(!hasServiceKey)('Merma simple de un vendedor o de la bodega (T-25, base real)', () => {
  let admin: TestUser
  let seller: TestUser
  let inactiveSeller: TestUser

  const asAdmin = () => ({ userId: admin.id, role: 'admin' })

  // Producto con `warehouse` piezas en bodega y, si se pide, `toSeller` de ellas dejadas al vendedor.
  const newProduct = async (warehouse: number, toSeller = 0) => {
    const created = await createProduct({
      name: productName(),
      categoryId: null,
      price: '900.00',
      unitCost: '450.0000',
      initialQty: warehouse + toSeller,
      fractionable: false,
      portionSize: null,
      image: null,
    }, admin.id)
    const id = created.id as number
    if (toSeller > 0) {
      await createDelivery({
        requestId: randomUUID(), sellerId: seller.id, productId: id, qty: toSeller, unitPrice: null, unitCostWithShipping: null,
      }, admin.id)
    }
    return id
  }

  const input = (productId: number, extra: Partial<CreateShrinkageInput> = {}): CreateShrinkageInput =>
    ({ requestId: randomUUID(), holderProfileId: seller.id, productId, qty: 2, reason: 'damaged', ...extra })

  const warehouseOf = async (id: number) => (await db.select().from(products).where(eq(products.id, id)))[0]!.stock
  const sellerOf = async (id: number) => {
    const [row] = await sql`select qty from vendor_stock where product_id = ${id} and profile_id = ${seller.id}`
    return (row?.qty as number | undefined) ?? 0
  }
  const shrinkRows = (id: number) =>
    db.select().from(stockMovements).where(eq(stockMovements.productId, id))
      .then((rows) => rows.filter((row) => row.type === 'shrinkage'))

  beforeAll(async () => {
    admin = await createTestUser('shr-admin', { role: 'admin' })
    seller = await createTestUser('shr-seller', { role: 'vendedor' })
    inactiveSeller = await createTestUser('shr-inactive', { role: 'vendedor', active: false })
  })
  afterAll(async () => {
    await cleanupShrinkage()
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  })

  it('merma de un vendedor: una fila shrinkage −2 con motivo, baja el vendedor y no la bodega', async () => {
    const id = await newProduct(4, 6)
    const request = input(id)
    const { shrinkage, replayed } = await createShrinkage(request, asAdmin())

    expect(replayed).toBe(false)
    expect(await sellerOf(id)).toBe(4)
    expect(await warehouseOf(id)).toBe(4)
    const rows = await shrinkRows(id)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ qty: -2, holderProfileId: seller.id, reason: 'damaged', requestId: request.requestId })
    expect(shrinkage).toMatchObject({
      requestId: request.requestId,
      qty: 2,
      reason: 'damaged',
      reasonLabel: 'Dañado',
      holder: { id: seller.id, fullName: 'Prueba shr-seller' },
      product: { id },
      stock: { before: 6, after: 4 },
    })
  })

  it('merma de la bodega: baja la bodega y la respuesta trae holder null', async () => {
    const id = await newProduct(10)
    const { shrinkage } = await createShrinkage(input(id, { holderProfileId: null, qty: 3, reason: 'expired' }), asAdmin())
    expect(await warehouseOf(id)).toBe(7)
    expect(shrinkage).toMatchObject({ holder: null, reasonLabel: 'Caducó', stock: { before: 10, after: 7 } })
  })

  it('409 si el titular no tiene piezas suficientes, sin filas nuevas', async () => {
    const id = await newProduct(1, 1)
    await expect(createShrinkage(input(id, { qty: 2 }), asAdmin()))
      .rejects.toMatchObject({ status: 409, message: 'No hay piezas suficientes' })
    await expect(createShrinkage(input(id, { holderProfileId: null, qty: 2 }), asAdmin()))
      .rejects.toMatchObject({ status: 409 })
    expect(await shrinkRows(id)).toHaveLength(0)
  })

  it('409 si el vendedor nunca tuvo el producto', async () => {
    const id = await newProduct(5)
    await expect(createShrinkage(input(id, { qty: 1 }), asAdmin())).rejects.toMatchObject({ status: 409 })
    expect(await shrinkRows(id)).toHaveLength(0)
  })

  it.each([0, -1, 2.5, MAX_QTY + 1])('422 con qty = %s', async (qty) => {
    const id = await newProduct(3, 3)
    await expect(createShrinkage(input(id, { qty }), asAdmin())).rejects.toMatchObject({ code: 'validation' })
  })

  it.each(['', 'robo', 'Dañado'])('422 con reason = %j', async (reason) => {
    const id = await newProduct(3, 3)
    await expect(createShrinkage(input(id, { reason }), asAdmin())).rejects.toMatchObject({ code: 'validation' })
  })

  it('404 si el producto no existe; un producto desactivado sí se merma', async () => {
    await expect(createShrinkage(input(2_000_000_000), asAdmin())).rejects.toMatchObject({ code: 'not_found' })
    const id = await newProduct(0, 3)
    await db.update(products).set({ active: false }).where(eq(products.id, id))
    const { shrinkage } = await createShrinkage(input(id, { qty: 1 }), asAdmin())
    expect(shrinkage.stock).toEqual({ before: 3, after: 2 })
  })

  it('404 con un vendedor desactivado, un administrador o un UUID inexistente como titular', async () => {
    const id = await newProduct(3, 3)
    for (const holderProfileId of [inactiveSeller.id, admin.id, randomUUID()]) {
      await expect(createShrinkage(input(id, { holderProfileId }), asAdmin())).rejects.toMatchObject({ code: 'not_found' })
    }
    expect(await shrinkRows(id)).toHaveLength(0)
  })

  it('403 si quien registra o consulta es un vendedor', async () => {
    const id = await newProduct(3, 3)
    const asSeller = { userId: seller.id, role: 'vendedor' }
    await expect(createShrinkage(input(id), asSeller)).rejects.toMatchObject({ code: 'forbidden' })
    await expect(getShrinkage(randomUUID(), asSeller)).rejects.toMatchObject({ code: 'forbidden' })
    expect(await shrinkRows(id)).toHaveLength(0)
  })

  it('repetir el requestId con los mismos datos responde la misma merma sin mover piezas', async () => {
    const id = await newProduct(0, 6)
    const request = input(id)
    const first = await createShrinkage(request, asAdmin())
    const again = await createShrinkage(request, asAdmin())
    expect(again.replayed).toBe(true)
    expect(again.shrinkage).toEqual(first.shrinkage)
    expect(await sellerOf(id)).toBe(4)
    expect(await shrinkRows(id)).toHaveLength(1)
  })

  it('409 al repetir el requestId con otro titular, producto, piezas o motivo', async () => {
    const id = await newProduct(5, 6)
    const other = await newProduct(5, 6)
    const request = input(id)
    await createShrinkage(request, asAdmin())
    for (const change of [{ holderProfileId: null }, { productId: other }, { qty: 1 }, { reason: 'lost' }]) {
      await expect(createShrinkage({ ...request, ...change }, asAdmin()))
        .rejects.toMatchObject({ status: 409, message: 'Esta merma ya se registró con otros datos.' })
    }
    expect(await shrinkRows(id)).toHaveLength(1)
    expect(await shrinkRows(other)).toHaveLength(0)
  })

  it('409 con el requestId de un retiro', async () => {
    const id = await newProduct(0, 6)
    const requestId = randomUUID()
    await createReturn({ requestId, sellerId: seller.id, productId: id, qty: 1 }, admin.id)
    await expect(createShrinkage(input(id, { requestId, qty: 1 }), asAdmin()))
      .rejects.toMatchObject({ status: 409, message: 'Esta merma ya se registró con otros datos.' })
    expect(await shrinkRows(id)).toHaveLength(0)
  })

  it('dos peticiones iguales a la vez dejan una sola merma', async () => {
    const id = await newProduct(0, 6)
    const request = input(id)
    const results = await Promise.all([createShrinkage(request, asAdmin()), createShrinkage(request, asAdmin())])
    expect(results.filter((r) => r.replayed)).toHaveLength(1)
    expect(await shrinkRows(id)).toHaveLength(1)
    expect(await sellerOf(id)).toBe(4)
  })

  it('el mismo requestId con otro titular a la vez deja una sola merma y el otro recibe 409', async () => {
    const id = await newProduct(6, 6)
    const request = input(id)
    const results = await Promise.allSettled([
      createShrinkage(request, asAdmin()),
      createShrinkage({ ...request, holderProfileId: null }, asAdmin()),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toMatchObject({ status: 409 })
    expect(await shrinkRows(id)).toHaveLength(1)
  })

  it('GET devuelve la merma con los mismos saldos; uno inexistente da 404', async () => {
    const id = await newProduct(0, 6)
    const { shrinkage } = await createShrinkage(input(id), asAdmin())
    await createShrinkage(input(id, { qty: 1 }), asAdmin()) // otra merma después no cambia la primera
    expect(await getShrinkage(shrinkage.requestId, asAdmin())).toEqual(shrinkage)
    await expect(getShrinkage(randomUUID(), asAdmin())).rejects.toMatchObject({ code: 'not_found' })
  })

  it('la base rechaza un motivo inválido y acepta una merma sin motivo', async () => {
    const id = await newProduct(3)
    const move = (reason: string | null) => withTransaction((tx) => insertMovements(tx, [{
      productId: id, type: 'shrinkage', qty: -1, holderProfileId: null, createdBy: admin.id, reason,
    }]))
    const err = await move('robo').catch((e: unknown) => e)
    expect(isCheckViolation(err, 'stock_movements_shrinkage_reason_check')).toBe(true)
    await expect(move(null)).resolves.toBeUndefined()
    expect(await warehouseOf(id)).toBe(2)
  })
})
