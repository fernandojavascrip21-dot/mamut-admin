import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, sql } from '@db/client'
import { products, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { createDelivery } from '@deliveries'
import { createFraction } from '@fractions'
import { createProduct } from '@products'
import {
  closeRestockOrder, createRestockOrder, deleteRestockOrder, getRestockOrder, getRestockSuggestions,
  listRestockOrders, updateRestockOrder, MAX_LINES, MAX_NOTE_LENGTH, MAX_QTY, LIST_LIMIT,
  ORDER_CLOSED, ORDER_MISMATCH, EMPTY_ORDER, PRODUCT_NOT_ORDERABLE, DUPLICATE_PRODUCT,
  type CreateRestockOrderInput, type RestockOrder,
} from '@restock'
import { insertMovements } from '@stock'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-rst-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

// Primero los pedidos de prueba (los renglones se van por cascada), luego movimientos del más nuevo
// al más viejo (revierten saldos), existencias de vendedor, fracciones, bolsitas y productos.
async function cleanupRestock(adminId: string | undefined) {
  if (adminId) await sql`delete from restock_orders where created_by = ${adminId}`
  const rows = await db.select({ id: products.id }).from(products).where(ilike(products.name, `${PREFIX}%`))
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return
  const movements = await db.select({ id: stockMovements.id }).from(stockMovements)
    .where(inArray(stockMovements.productId, ids)).orderBy(desc(stockMovements.id))
  for (const movement of movements) {
    await db.delete(stockMovements).where(eq(stockMovements.id, movement.id))
  }
  await db.delete(vendorStock).where(inArray(vendorStock.productId, ids))
  await sql`delete from fractions where product_id = any(${ids}) or portion_product_id = any(${ids})`
  const portions = await db.select({ id: products.id }).from(products).where(inArray(products.parentProductId, ids))
  if (portions.length > 0) await db.delete(products).where(inArray(products.id, portions.map((p) => p.id)))
  await db.delete(products).where(inArray(products.id, ids))
}

describe.skipIf(!hasServiceKey)('Base de pedidos de resurtir (T-36, base real)', () => {
  let admin: TestUser
  let seller: TestUser

  const asAdmin = () => ({ userId: admin.id, role: 'admin' })
  const asSeller = () => ({ userId: seller.id, role: 'vendedor' })

  // Con 0 piezas no se puede crear (initial > 0): se crea con 1 y se da de baja con una merma.
  const newProduct = async (opts: { qty?: number; unitCost?: string; label?: string } = {}) => {
    const qty = opts.qty ?? 5
    const created = await createProduct({
      name: productName(opts.label ?? 'prod'), categoryId: null, price: '900.00',
      unitCost: opts.unitCost ?? '450.0000', initialQty: qty === 0 ? 1 : qty,
      fractionable: false, portionSize: null, image: null,
    }, admin.id)
    if (qty === 0) {
      await withTransaction((tx) => insertMovements(tx, [{
        productId: created.id as number, type: 'shrinkage', qty: -1, holderProfileId: null, createdBy: admin.id,
      }]))
    }
    return created.id as number
  }

  const input = (lines: CreateRestockOrderInput['lines'], extra: Partial<CreateRestockOrderInput> = {}): CreateRestockOrderInput =>
    ({ requestId: randomUUID(), note: null, lines, ...extra })

  const draft = async (lines: CreateRestockOrderInput['lines'], extra: Partial<CreateRestockOrderInput> = {}): Promise<RestockOrder> =>
    (await createRestockOrder(input(lines, extra), asAdmin())).order

  const setCost = (id: number, cost: string) => db.update(products).set({ unitCost: cost }).where(eq(products.id, id))
  const countOrders = async (requestId: string) => {
    const [row] = await sql`select count(*)::int as n from restock_orders where request_id = ${requestId}`
    return row!.n as number
  }
  const countLines = async (orderId: number) => {
    const [row] = await sql`select count(*)::int as n from restock_order_lines where order_id = ${orderId}`
    return row!.n as number
  }
  const inventorySnapshot = async (ids: number[]) => {
    const [mov] = await sql`select count(*)::int as n from stock_movements where product_id = any(${ids})`
    const stock = await db.select({ id: products.id, stock: products.stock }).from(products).where(inArray(products.id, ids)).orderBy(products.id)
    const vendor = await db.select().from(vendorStock).where(inArray(vendorStock.productId, ids))
    return { movements: mov!.n as number, stock, vendor }
  }

  beforeAll(async () => {
    admin = await createTestUser('rst-admin', { role: 'admin' })
    seller = await createTestUser('rst-seller', { role: 'vendedor' })
  })
  afterAll(async () => {
    await cleanupRestock(admin?.id)
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  })

  describe('sugerencias', () => {
    const mine = (list: { name: string }[]) => list.filter((row) => row.name.startsWith(PREFIX))

    it('trae A (0, out) y B (2, low) en ese orden con units y unitCost, y no trae C (3)', async () => {
      const a = await newProduct({ qty: 0, unitCost: '12.5000', label: 'sug-a' })
      const b = await newProduct({ qty: 2, unitCost: '99.1234', label: 'sug-b' })
      const c = await newProduct({ qty: 3, label: 'sug-c' })
      const { suggestions } = await getRestockSuggestions(asAdmin())
      const ids = mine(suggestions).map((row) => row.productId)
      expect(ids.indexOf(a)).toBeGreaterThanOrEqual(0)
      expect(ids.indexOf(a)).toBeLessThan(ids.indexOf(b))
      expect(ids).not.toContain(c)
      expect(suggestions.find((row) => row.productId === a)).toMatchObject({ units: 0, stockLevel: 'out', unitCost: '12.5000' })
      expect(suggestions.find((row) => row.productId === b)).toMatchObject({ units: 2, stockLevel: 'low', unitCost: '99.1234' })
    })

    it('no trae un producto desactivado con 0 piezas ni una bolsita con 1 pieza en bodega', async () => {
      const inactive = await newProduct({ qty: 0, label: 'sug-inactivo' })
      await db.update(products).set({ active: false }).where(eq(products.id, inactive))
      const whole = await createProduct({
        name: productName('sug-entero'), categoryId: null, price: '900.00', unitCost: '450.0000',
        initialQty: 3, fractionable: true, portionSize: '250 g', image: null,
      }, admin.id)
      const { fraction } = await createFraction(
        { requestId: randomUUID(), productId: whole.id as number, portions: 1, price: '85.00' }, asAdmin())
      const bagId = fraction.portionProduct.id
      const { suggestions } = await getRestockSuggestions(asAdmin())
      const ids = suggestions.map((row) => row.productId)
      expect(ids).not.toContain(inactive)
      expect(ids).not.toContain(bagId)
    })

    it('trae un producto con 0 en bodega aunque un vendedor tenga 5 piezas', async () => {
      const id = await newProduct({ qty: 5, label: 'sug-vendedor' })
      await createDelivery({
        requestId: randomUUID(), sellerId: seller.id, productId: id, qty: 5, unitPrice: null, unitCostWithShipping: null,
      }, admin.id)
      const { suggestions } = await getRestockSuggestions(asAdmin())
      expect(suggestions.find((row) => row.productId === id)).toMatchObject({ units: 0, stockLevel: 'out' })
    })
  })

  describe('alta', () => {
    it('crea un borrador con nota, dos renglones, fechas y closedAt null', async () => {
      const a = await newProduct({ unitCost: '10.5000' })
      const b = await newProduct({ unitCost: '20.2500' })
      const { order, replayed } = await createRestockOrder(
        input([{ productId: a, qty: 3 }, { productId: b, qty: 4 }], { note: '  Pedido de prueba  ' }), asAdmin())
      expect(replayed).toBe(false)
      expect(order).toMatchObject({ status: 'draft', note: 'Pedido de prueba', closedAt: null, lineCount: 2, totalUnits: 7 })
      expect(order.createdAt).toBeTruthy()
      expect(order.updatedAt).toBeTruthy()
      expect(order.lines.map((line) => ({ id: line.product.id, qty: line.qty, unitCost: line.unitCost }))).toEqual([
        { id: a, qty: 3, unitCost: '10.5000' }, { id: b, qty: 4, unitCost: '20.2500' },
      ])
    })

    it('cambiar después el costo del producto no cambia el costo del pedido', async () => {
      const a = await newProduct({ unitCost: '10.0000' })
      const order = await draft([{ productId: a, qty: 1 }])
      await setCost(a, '15.0000')
      const read = await getRestockOrder(order.id, asAdmin())
      expect(read.lines[0]!.unitCost).toBe('10.0000')
    })

    it('una nota vacía o solo espacios se guarda como null', async () => {
      const a = await newProduct()
      expect((await draft([{ productId: a, qty: 1 }], { note: '' })).note).toBeNull()
      expect((await draft([{ productId: a, qty: 1 }], { note: '   ' })).note).toBeNull()
    })
  })

  describe('inventario', () => {
    it('ningún caso de uso agrega movimientos ni cambia products.stock o vendor_stock', async () => {
      const a = await newProduct({ qty: 2 })
      const b = await newProduct({ qty: 4 })
      const before = await inventorySnapshot([a, b])
      await getRestockSuggestions(asAdmin())
      const order = await draft([{ productId: a, qty: 3 }])
      await updateRestockOrder(order.id, { note: 'x', lines: [{ productId: a, qty: 5 }, { productId: b, qty: 1 }] }, asAdmin())
      await getRestockOrder(order.id, asAdmin())
      await listRestockOrders({}, asAdmin())
      await closeRestockOrder(order.id, asAdmin())
      const other = await draft([{ productId: b, qty: 2 }])
      await deleteRestockOrder(other.id, asAdmin())
      expect(await inventorySnapshot([a, b])).toEqual(before)
    })
  })

  describe('idempotencia', () => {
    it('repetir con los mismos datos en otro orden responde replayed: true con el mismo pedido', async () => {
      const a = await newProduct()
      const b = await newProduct()
      const body = input([{ productId: a, qty: 1 }, { productId: b, qty: 2 }], { note: 'igual' })
      const first = await createRestockOrder(body, asAdmin())
      const second = await createRestockOrder({ ...body, lines: [{ productId: b, qty: 2 }, { productId: a, qty: 1 }] }, asAdmin())
      expect(second.replayed).toBe(true)
      expect(second.order.id).toBe(first.order.id)
      expect(await countOrders(body.requestId)).toBe(1)
    })

    it('el mismo requestId con otros datos responde 409', async () => {
      const a = await newProduct()
      const body = input([{ productId: a, qty: 1 }])
      await createRestockOrder(body, asAdmin())
      await expect(createRestockOrder({ ...body, lines: [{ productId: a, qty: 2 }] }, asAdmin()))
        .rejects.toMatchObject({ code: 'conflict', message: ORDER_MISMATCH })
    })

    it('dos altas iguales a la vez dejan un solo pedido', async () => {
      const a = await newProduct()
      const body = input([{ productId: a, qty: 1 }])
      const results = await Promise.all([createRestockOrder(body, asAdmin()), createRestockOrder(body, asAdmin())])
      expect(results[0].order.id).toBe(results[1].order.id)
      expect(results.filter((r) => r.replayed)).toHaveLength(1)
      expect(await countOrders(body.requestId)).toBe(1)
    })
  })

  describe('validaciones', () => {
    it.each([0, -1, 2.5, MAX_QTY + 1])('qty %s responde 422', async (qty) => {
      const a = await newProduct()
      await expect(createRestockOrder(input([{ productId: a, qty }]), asAdmin())).rejects.toMatchObject({ code: 'validation' })
    })

    it('un producto repetido responde 422', async () => {
      const a = await newProduct()
      await expect(createRestockOrder(input([{ productId: a, qty: 1 }, { productId: a, qty: 2 }]), asAdmin()))
        .rejects.toMatchObject({ code: 'validation', message: DUPLICATE_PRODUCT })
    })

    it('más de 200 renglones responde 422', async () => {
      const lines = Array.from({ length: MAX_LINES + 1 }, (_, i) => ({ productId: 1_000_000 + i, qty: 1 }))
      await expect(createRestockOrder(input(lines), asAdmin())).rejects.toMatchObject({ code: 'validation' })
    })

    it('una nota de más de 500 caracteres responde 422', async () => {
      const a = await newProduct()
      await expect(createRestockOrder(input([{ productId: a, qty: 1 }], { note: 'x'.repeat(MAX_NOTE_LENGTH + 1) }), asAdmin()))
        .rejects.toMatchObject({ code: 'validation' })
    })

    it('un producto desactivado responde 422', async () => {
      const a = await newProduct()
      await db.update(products).set({ active: false }).where(eq(products.id, a))
      await expect(createRestockOrder(input([{ productId: a, qty: 1 }]), asAdmin()))
        .rejects.toMatchObject({ code: 'validation', message: PRODUCT_NOT_ORDERABLE })
    })

    it('una bolsita responde 422', async () => {
      const whole = await createProduct({
        name: productName('val-entero'), categoryId: null, price: '900.00', unitCost: '450.0000',
        initialQty: 3, fractionable: true, portionSize: '250 g', image: null,
      }, admin.id)
      const { fraction } = await createFraction(
        { requestId: randomUUID(), productId: whole.id as number, portions: 2, price: '85.00' }, asAdmin())
      await expect(createRestockOrder(input([{ productId: fraction.portionProduct.id, qty: 1 }]), asAdmin()))
        .rejects.toMatchObject({ code: 'validation', message: PRODUCT_NOT_ORDERABLE })
    })

    it('un requestId que no es UUID responde 422', async () => {
      const a = await newProduct()
      await expect(createRestockOrder(input([{ productId: a, qty: 1 }], { requestId: 'no-es-uuid' }), asAdmin()))
        .rejects.toMatchObject({ code: 'validation' })
    })

    it('un producto inexistente responde 404', async () => {
      await expect(createRestockOrder(input([{ productId: 2_000_000_000, qty: 1 }]), asAdmin()))
        .rejects.toMatchObject({ code: 'not_found' })
    })
  })

  describe('edición', () => {
    it('reemplaza nota y renglones, actualiza updatedAt, conserva el costo del renglón existente y toma el actual en el nuevo', async () => {
      const a = await newProduct({ unitCost: '10.0000' })
      const b = await newProduct({ unitCost: '20.0000' })
      const c = await newProduct({ unitCost: '30.0000' })
      const order = await draft([{ productId: a, qty: 1 }, { productId: b, qty: 1 }], { note: 'antes' })
      await setCost(a, '11.0000')
      await setCost(c, '33.0000')
      const updated = await updateRestockOrder(order.id, { note: 'después', lines: [{ productId: a, qty: 9 }, { productId: c, qty: 2 }] }, asAdmin())
      expect(updated.note).toBe('después')
      expect(updated.lines.map((line) => ({ id: line.product.id, qty: line.qty, unitCost: line.unitCost }))).toEqual([
        { id: a, qty: 9, unitCost: '10.0000' }, { id: c, qty: 2, unitCost: '33.0000' },
      ])
      expect(updated.lineCount).toBe(2)
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(new Date(order.updatedAt).getTime())
    })
  })

  describe('cierre', () => {
    it('pasa a closed con closedAt y después PUT, DELETE y otro cierre responden 409', async () => {
      const a = await newProduct()
      const order = await draft([{ productId: a, qty: 1 }])
      const closed = await closeRestockOrder(order.id, asAdmin())
      expect(closed.status).toBe('closed')
      expect(closed.closedAt).not.toBeNull()
      const conflict = { code: 'conflict', message: ORDER_CLOSED }
      await expect(updateRestockOrder(order.id, { note: null, lines: [{ productId: a, qty: 2 }] }, asAdmin())).rejects.toMatchObject(conflict)
      await expect(deleteRestockOrder(order.id, asAdmin())).rejects.toMatchObject(conflict)
      await expect(closeRestockOrder(order.id, asAdmin())).rejects.toMatchObject(conflict)
    })

    it('cerrar un borrador sin renglones responde 422', async () => {
      const order = await draft([])
      await expect(closeRestockOrder(order.id, asAdmin())).rejects.toMatchObject({ code: 'validation', message: EMPTY_ORDER })
    })
  })

  describe('borrado', () => {
    it('borra un borrador y sus renglones; uno inexistente responde 404', async () => {
      const a = await newProduct()
      const order = await draft([{ productId: a, qty: 1 }])
      expect(await countLines(order.id)).toBe(1)
      await deleteRestockOrder(order.id, asAdmin())
      expect(await countLines(order.id)).toBe(0)
      await expect(getRestockOrder(order.id, asAdmin())).rejects.toMatchObject({ code: 'not_found' })
      await expect(deleteRestockOrder(order.id, asAdmin())).rejects.toMatchObject({ code: 'not_found' })
    })
  })

  describe('lista y detalle', () => {
    it('trae a lo más 50 pedidos, el más nuevo primero, con lineCount y totalUnits', async () => {
      const a = await newProduct()
      for (let i = 0; i < LIST_LIMIT + 1; i++) await draft([{ productId: a, qty: 2 }])
      const last = await draft([{ productId: a, qty: 7 }])
      const { orders } = await listRestockOrders({}, asAdmin())
      expect(orders).toHaveLength(LIST_LIMIT)
      expect(orders[0]).toMatchObject({ id: last.id, lineCount: 1, totalUnits: 7 })
      expect(orders[0]).not.toHaveProperty('lines')
      const times = orders.map((o) => new Date(o.createdAt).getTime())
      expect(times).toEqual([...times].sort((x, y) => y - x))
    })

    it('?status=closed trae solo cerrados y otro valor responde 422', async () => {
      const a = await newProduct()
      const order = await draft([{ productId: a, qty: 1 }])
      await closeRestockOrder(order.id, asAdmin())
      const { orders } = await listRestockOrders({ status: 'closed' }, asAdmin())
      expect(orders.length).toBeGreaterThan(0)
      expect(orders.every((o) => o.status === 'closed')).toBe(true)
      await expect(listRestockOrders({ status: 'otro' }, asAdmin())).rejects.toMatchObject({ code: 'validation' })
    })

    it('el detalle trae los renglones en el orden guardado, aunque un producto se desactive; inexistente 404', async () => {
      const a = await newProduct({ label: 'det-a' })
      const b = await newProduct({ label: 'det-b' })
      const order = await draft([{ productId: b, qty: 1 }, { productId: a, qty: 2 }])
      await db.update(products).set({ active: false }).where(eq(products.id, a))
      const read = await getRestockOrder(order.id, asAdmin())
      expect(read.lines.map((line) => line.product.id)).toEqual([b, a])
      expect(read.lines[1]!.product.name).toContain('det-a')
      await expect(getRestockOrder(2_000_000_000, asAdmin())).rejects.toMatchObject({ code: 'not_found' })
    })
  })

  describe('permisos', () => {
    it('un vendedor recibe 403 en todos los casos de uso', async () => {
      const a = await newProduct()
      const order = await draft([{ productId: a, qty: 1 }])
      const forbidden = { code: 'forbidden' }
      await expect(getRestockSuggestions(asSeller())).rejects.toMatchObject(forbidden)
      await expect(createRestockOrder(input([{ productId: a, qty: 1 }]), asSeller())).rejects.toMatchObject(forbidden)
      await expect(updateRestockOrder(order.id, { note: null, lines: [] }, asSeller())).rejects.toMatchObject(forbidden)
      await expect(closeRestockOrder(order.id, asSeller())).rejects.toMatchObject(forbidden)
      await expect(deleteRestockOrder(order.id, asSeller())).rejects.toMatchObject(forbidden)
      await expect(getRestockOrder(order.id, asSeller())).rejects.toMatchObject(forbidden)
      await expect(listRestockOrders({}, asSeller())).rejects.toMatchObject(forbidden)
    })
  })
})
