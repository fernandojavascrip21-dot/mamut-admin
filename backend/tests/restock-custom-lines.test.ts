import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from '@db/client'
import {
  closeRestockOrder, createRestockOrder, getRestockOrder, listRestockOrders, updateRestockOrder,
  DUPLICATE_CUSTOM, MAX_LINES, ORDER_MISMATCH,
  type RestockOrder,
} from '@restock'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'
import { cleanupRestockData, createRestockProduct, RESTOCK_PREFIX } from './helpers/restock'

// Renglones escritos a mano (HU-31): texto del pedido, sin producto de catálogo.
describe.skipIf(!hasServiceKey)('Renglones escritos a mano en pedidos de resurtir (HU-31, base real)', () => {
  let admin: TestUser
  const asAdmin = () => ({ userId: admin.id, role: 'admin' })
  const custom = (label: string) => `${RESTOCK_PREFIX}escrito-${label}-${Date.now()}`

  // Los renglones nuevos llevan formas que el tipo actual aún no admite: se pasan como están.
  const create = async (lines: unknown[], extra: Record<string, unknown> = {}): Promise<RestockOrder> =>
    (await createRestockOrder({ requestId: randomUUID(), note: null, lines, ...extra } as never, asAdmin())).order
  const update = (id: number, lines: unknown[]) => updateRestockOrder(id, { note: null, lines } as never, asAdmin())
  const countRows = async (table: 'products' | 'stock_movements') => {
    const [row] = table === 'products'
      ? await sql`select count(*)::int as n from products where name like ${`${RESTOCK_PREFIX}%`}`
      : await sql`select count(*)::int as n from stock_movements`
    return row!.n as number
  }

  beforeAll(async () => {
    admin = await createTestUser('rst-cl-admin', { role: 'admin' })
  })
  afterAll(async () => {
    await cleanupRestockData(admin?.id)
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  })

  it('el alta guarda un renglón escrito con su costo y el detalle lo trae en customLines', async () => {
    const name = custom('alta')
    const order = await create([{ name, qty: 4, unitCost: '12.5000' }])
    expect(order.lines).toEqual([])
    expect(order.customLines).toEqual([{ id: expect.any(Number), name, qty: 4, unitCost: '12.5000' }])
    const read = await getRestockOrder(order.id, asAdmin())
    expect(read.customLines).toMatchObject([{ name, qty: 4, unitCost: '12.5000' }])
  })

  it('un renglón escrito sin costo guarda unitCost null', async () => {
    const order = await create([{ name: custom('sin-costo'), qty: 1, unitCost: null }])
    expect(order.customLines[0]).toMatchObject({ unitCost: null })
  })

  it('el nombre se recorta antes de guardarse', async () => {
    const order = await create([{ name: `  ${custom('recorte')}  `, qty: 1, unitCost: null }])
    expect(order.customLines[0]!.name).toBe(order.customLines[0]!.name.trim())
  })

  it('un renglón de catálogo y uno escrito conviven: lineCount y totalUnits cuentan ambos', async () => {
    const a = await createRestockProduct(admin.id, { label: 'mix' })
    const order = await create([{ productId: a, qty: 2 }, { name: custom('mix'), qty: 3, unitCost: '1.0000' }])
    expect(order).toMatchObject({ lineCount: 2, totalUnits: 5 })
    expect(order.lines).toHaveLength(1)
    expect(order.customLines).toHaveLength(1)
    const { orders } = await listRestockOrders({}, asAdmin())
    expect(orders.find((o) => o.id === order.id)).toMatchObject({ lineCount: 2, totalUnits: 5 })
  })

  it('retomar el borrador devuelve los renglones escritos y PUT los reemplaza', async () => {
    const order = await create([{ name: custom('antes'), qty: 1, unitCost: null }])
    const nuevo = custom('despues')
    const updated = await update(order.id, [{ name: nuevo, qty: 7, unitCost: '2.5000' }])
    expect(updated.customLines).toMatchObject([{ name: nuevo, qty: 7, unitCost: '2.5000' }])
    expect((await getRestockOrder(order.id, asAdmin())).customLines).toHaveLength(1)
  })

  it('un pedido con solo renglones escritos se puede cerrar', async () => {
    const order = await create([{ name: custom('cierre'), qty: 2, unitCost: null }])
    const closed = await closeRestockOrder(order.id, asAdmin())
    expect(closed.status).toBe('closed')
    expect(closed.customLines).toHaveLength(1)
  })

  it('un nombre igual al de un producto del catálogo se permite', async () => {
    const id = await createRestockProduct(admin.id, { label: 'igual' })
    const [row] = await sql`select name from products where id = ${id}`
    const order = await create([{ productId: id, qty: 1 }, { name: row!.name, qty: 1, unitCost: null }])
    expect(order.lineCount).toBe(2)
  })

  describe('422', () => {
    const invalid = { code: 'validation' }

    it('nombre vacío, de solo espacios o de más de 120 caracteres', async () => {
      for (const name of ['', '   ', 'x'.repeat(121)]) {
        await expect(create([{ name, qty: 1, unitCost: null }])).rejects.toMatchObject(invalid)
      }
    })

    it('un nombre de exactamente 120 caracteres es válido', async () => {
      const order = await create([{ name: 'y'.repeat(120), qty: 1, unitCost: null }])
      expect(order.customLines[0]!.name).toHaveLength(120)
    })

    it('el mismo nombre escrito dos veces (sin importar mayúsculas)', async () => {
      const name = custom('repe')
      await expect(create([{ name, qty: 1, unitCost: null }, { name: name.toUpperCase(), qty: 2, unitCost: null }]))
        .rejects.toMatchObject({ ...invalid, message: DUPLICATE_CUSTOM })
    })

    it('costo con más de 4 decimales, negativo, fuera de rango o texto', async () => {
      for (const unitCost of ['1.23456', '-1', '1000000', 'abc']) {
        await expect(create([{ name: custom('costo'), qty: 1, unitCost }])).rejects.toMatchObject(invalid)
      }
    })

    it('un renglón con productId y name a la vez, o con ninguno de los dos', async () => {
      const a = await createRestockProduct(admin.id, { label: 'ambos' })
      await expect(create([{ productId: a, name: custom('ambos'), qty: 1, unitCost: null }])).rejects.toMatchObject(invalid)
      await expect(create([{ qty: 1, unitCost: null }])).rejects.toMatchObject(invalid)
    })

    it('un renglón escrito con piezas inválidas', async () => {
      for (const qty of [0, -1, 1.5, 2_147_483_648]) {
        await expect(create([{ name: custom('qty'), qty, unitCost: null }])).rejects.toMatchObject(invalid)
      }
    })

    it('PUT con el mismo nombre repetido también responde 422', async () => {
      const order = await create([{ name: custom('put'), qty: 1, unitCost: null }])
      const name = custom('put-dup')
      await expect(update(order.id, [{ name, qty: 1, unitCost: null }, { name, qty: 1, unitCost: null }]))
        .rejects.toMatchObject(invalid)
    })
  })

  describe('idempotencia del alta', () => {
    it('el mismo requestId con los mismos renglones (en otro orden) responde replayed', async () => {
      const a = await createRestockProduct(admin.id, { label: 'idem' })
      const name = custom('idem')
      const requestId = randomUUID()
      const lines = [{ productId: a, qty: 1, unitCost: '3.0000' }, { name, qty: 2, unitCost: '4.0000' }]
      const first = await createRestockOrder({ requestId, note: null, lines } as never, asAdmin())
      const again = await createRestockOrder({ requestId, note: null, lines: [...lines].reverse() } as never, asAdmin())
      expect(again.replayed).toBe(true)
      expect(again.order.id).toBe(first.order.id)
    })

    it('el mismo requestId con otro nombre, otro costo u otras piezas responde 409', async () => {
      const name = custom('idem-409')
      const requestId = randomUUID()
      await createRestockOrder({ requestId, note: null, lines: [{ name, qty: 1, unitCost: '4.0000' }] } as never, asAdmin())
      for (const line of [
        { name: custom('otro'), qty: 1, unitCost: '4.0000' },
        { name, qty: 1, unitCost: '5.0000' },
        { name, qty: 2, unitCost: '4.0000' },
      ]) {
        await expect(createRestockOrder({ requestId, note: null, lines: [line] } as never, asAdmin()))
          .rejects.toMatchObject({ code: 'conflict', message: ORDER_MISMATCH })
      }
    })
  })

  describe('tope de renglones', () => {
    it('200 renglones entre catálogo y escritos se aceptan y 201 responden 422', async () => {
      const a = await createRestockProduct(admin.id, { label: 'tope' })
      const escritos = (n: number) => Array.from({ length: n }, (_, i) => ({ name: custom(`tope-${i}`), qty: 1, unitCost: null }))
      const ok = await create([{ productId: a, qty: 1 }, ...escritos(MAX_LINES - 1)])
      expect(ok.lineCount).toBe(MAX_LINES)
      await expect(create([{ productId: a, qty: 1 }, ...escritos(MAX_LINES)])).rejects.toMatchObject({ code: 'validation' })
    })
  })

  it('no crea productos ni movimientos de inventario', async () => {
    const productsBefore = await countRows('products')
    const movementsBefore = await countRows('stock_movements')
    const order = await create([{ name: custom('sin-efectos'), qty: 9, unitCost: '1.0000' }])
    await update(order.id, [{ name: custom('sin-efectos-2'), qty: 9, unitCost: '1.0000' }])
    await closeRestockOrder(order.id, asAdmin())
    expect(await countRows('products')).toBe(productsBefore)
    expect(await countRows('stock_movements')).toBe(movementsBefore)
  })
})
