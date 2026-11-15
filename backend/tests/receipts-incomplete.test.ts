import { desc, eq, ilike, inArray } from 'drizzle-orm'
import ExcelJS from 'exceljs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, sql } from '@db/client'
import { products, stockMovements } from '@db/schema'
import {
  confirmReceipt,
  createProductFromLine,
  discardLine,
  getReceipt,
  listPendingReceiptLines,
  previewReceipt,
} from '@receipts'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-rcp-'
const uniqueName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

type Cell = string | number | null
const HEADER: Cell[] = ['Descripción', 'Cant.', 'Costo unitario']

async function buildXlsx(rows: Cell[][]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Remision')
  for (const row of rows) sheet.addRow(row)
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}

// Borra primero los movimientos de remisión (más nuevo a más viejo), luego renglones, remisiones y productos.
async function cleanupReceipts(adminId: string | undefined) {
  if (adminId) {
    const lineMovements = await sql`
      select m.id from stock_movements m
      join supplier_receipt_lines l on l.id = m.receipt_line_id
      join supplier_receipts r on r.id = l.receipt_id
      where r.created_by = ${adminId} order by m.id desc`
    for (const row of lineMovements) await db.delete(stockMovements).where(eq(stockMovements.id, row.id as number))
    await sql`delete from supplier_receipt_lines where receipt_id in (select id from supplier_receipts where created_by = ${adminId})`
    await sql`delete from supplier_receipts where created_by = ${adminId}`
  }
  await sql`delete from supplier_product_aliases where normalized_name like 'test rcp%'`
  const rows = await db.select({ id: products.id }).from(products).where(ilike(products.name, `${PREFIX}%`))
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return
  const movements = await db.select({ id: stockMovements.id }).from(stockMovements)
    .where(inArray(stockMovements.productId, ids)).orderBy(desc(stockMovements.id))
  for (const movement of movements) await db.delete(stockMovements).where(eq(stockMovements.id, movement.id))
  await db.delete(products).where(inArray(products.id, ids))
}

describe.skipIf(!hasServiceKey)('Renglones por completar de una remisión (base real)', () => {
  let admin: TestUser
  let seller: TestUser
  const asAdmin = () => ({ userId: admin.id, role: 'admin' })
  const asSeller = () => ({ userId: seller.id, role: 'vendedor' })

  const preview = async (rows: Cell[][]) =>
    previewReceipt(new File([new Uint8Array(await buildXlsx([HEADER, ...rows]))], 'remision.xlsx'), asAdmin())

  const confirmWithIncomplete = (readName: string, unitCost: string | null, requestId: string = randomUUID()) =>
    ({ requestId, source: 'excel' as const, fileName: 'remision.xlsx', lines: [], incomplete: [{ readName, unitCost }] })

  const countMovements = async () =>
    (await sql`select count(*)::int as n from stock_movements`)[0]!.n as number
  const stockOf = async (id: number) => (await db.select().from(products).where(eq(products.id, id)))[0]!.stock

  beforeAll(async () => {
    admin = await createTestUser('rcp-inc-admin', { role: 'admin' })
    seller = await createTestUser('rcp-inc-seller', { role: 'vendedor' })
  })
  afterAll(async () => {
    await cleanupReceipts(admin?.id)
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  })

  describe('Vista previa', () => {
    it('devuelve en incomplete el renglón con piezas inválidas con su posición, nombre y costo leído', async () => {
      const name = uniqueName('bloom')
      const result = await preview([[name, null, '495']])
      expect(result.incomplete).toHaveLength(1)
      expect(result.incomplete[0]).toMatchObject({ position: 2, readName: name, unitCost: '495.0000' })
    })

    it('con piezas en 0 también lo rescata, y con costo inválido deja unitCost en null', async () => {
      const zero = uniqueName('cero')
      const badCost = uniqueName('malcosto')
      const result = await preview([[zero, 0, '10'], [badCost, 'abc', 'xx']])
      expect(result.incomplete.map((l) => l.readName)).toEqual([zero, badCost])
      expect(result.incomplete[1]!.unitCost).toBeNull()
    })

    it('skipped conserva su forma: sigue trayendo position, text, reason y label', async () => {
      const result = await preview([[uniqueName('forma'), 0, '10']])
      expect(result.skipped[0]).toEqual({
        position: 2, text: expect.any(String), reason: 'invalid_qty', label: 'Las piezas no son un número entero mayor a 0',
      })
    })

    it('un renglón con costo inválido pero piezas válidas no va a incomplete', async () => {
      const result = await preview([[uniqueName('cinco'), 1, '1.23456']])
      expect(result.incomplete).toEqual([])
    })
  })

  describe('Confirmar', () => {
    it('guarda el renglón como incomplete, con qty null y sin movimiento de inventario', async () => {
      const name = uniqueName('guardar')
      const before = await countMovements()
      const input = confirmWithIncomplete(name, '495')
      await confirmReceipt(input, asAdmin())
      const rows = await sql`
        select l.status, l.qty, l.unit_cost::text as unit_cost from supplier_receipt_lines l
        join supplier_receipts r on r.id = l.receipt_id where r.request_id = ${input.requestId}`
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ status: 'incomplete', qty: null, unit_cost: '495.0000' })
      expect(await countMovements()).toBe(before)
    })

    it('reintentar con el mismo requestId es idempotente: una sola remisión y un solo renglón', async () => {
      const input = confirmWithIncomplete(uniqueName('reintento'), '12')
      await confirmReceipt(input, asAdmin())
      const again = await confirmReceipt(input, asAdmin())
      expect(again.replayed).toBe(true)
      const [count] = await sql`select count(*)::int as n from supplier_receipt_lines l
        join supplier_receipts r on r.id = l.receipt_id where r.request_id = ${input.requestId}`
      expect(count!.n).toBe(1)
    })

    it('getReceipt no lista el renglón incomplete como recibido', async () => {
      const input = confirmWithIncomplete(uniqueName('get'), '5')
      await confirmReceipt(input, asAdmin())
      const receipt = await getReceipt(input.requestId, asAdmin())
      expect(receipt.lines.every((line) => line.status !== 'received')).toBe(true)
      expect(receipt.units).toEqual([])
    })

    it('sin lines ni incomplete responde 422', async () => {
      await expect(confirmReceipt({ requestId: randomUUID(), source: 'excel', fileName: null, lines: [] }, asAdmin()))
        .rejects.toMatchObject({ code: 'validation' })
    })
  })

  describe('Pendientes', () => {
    const incompleteLine = async (unitCost: string | null = '8') => {
      const name = uniqueName('pend')
      const input = confirmWithIncomplete(name, unitCost)
      await confirmReceipt(input, asAdmin())
      const pending = await listPendingReceiptLines(asAdmin())
      const found = pending.incompleteProducts.find((l) => l.suggestedName.toLowerCase().includes(name.toLowerCase()) || l.receipt.requestId === input.requestId)
      return { name, lineId: found!.lineId, found: found! }
    }

    it('listPendingReceiptLines devuelve incompleteProducts con qty null y el costo leído', async () => {
      const { found } = await incompleteLine('8')
      expect(found).toMatchObject({ qty: null, unitCost: '8.0000' })
    })

    it('dar de alta sin qty responde 422 INVALID_QTY y con qty inválida también', async () => {
      const { lineId } = await incompleteLine()
      await expect(createProductFromLine(lineId, { name: uniqueName('sinqty'), price: '100.00', categoryId: null }, asAdmin()))
        .rejects.toMatchObject({ code: 'validation' })
      await expect(createProductFromLine(lineId, { name: uniqueName('qty0'), price: '100.00', categoryId: null, qty: 0 }, asAdmin()))
        .rejects.toMatchObject({ code: 'validation' })
    })

    it('dar de alta con qty crea el producto, la bodega sube con un purchase y el renglón queda created con esa qty', async () => {
      const { lineId } = await incompleteLine()
      const result = await createProductFromLine(lineId, { name: uniqueName('alta'), price: '100.00', categoryId: null, qty: 6 }, asAdmin())
      expect(result.stock).toEqual({ before: 0, after: 6 })
      expect(await stockOf(result.product.id as number)).toBe(6)
      expect(result.line).toMatchObject({ status: 'created', qty: 6 })
      const [movement] = await sql`select type, qty from stock_movements where receipt_line_id = ${lineId}`
      expect(movement).toMatchObject({ type: 'purchase', qty: 6 })
    })

    it('descartar deja el renglón discarded, sin movimiento, y sale de incompleteProducts', async () => {
      const { lineId } = await incompleteLine()
      const before = await countMovements()
      const { line } = await discardLine(lineId, asAdmin())
      expect(line.status).toBe('discarded')
      expect(await countMovements()).toBe(before)
      expect((await listPendingReceiptLines(asAdmin())).incompleteProducts.some((l) => l.lineId === lineId)).toBe(false)
    })
  })

  it('un vendedor recibe 403 al confirmar con incomplete y al dar de alta un por completar', async () => {
    const forbidden = { code: 'forbidden' }
    await expect(confirmReceipt(confirmWithIncomplete('x', null), asSeller())).rejects.toMatchObject(forbidden)
    await expect(createProductFromLine(1, { name: 'x', price: '1.00', categoryId: null, qty: 1 }, asSeller())).rejects.toMatchObject(forbidden)
  })
})
