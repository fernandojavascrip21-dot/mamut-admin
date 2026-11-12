import { desc, eq, ilike, inArray } from 'drizzle-orm'
import ExcelJS from 'exceljs'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, sql } from '@db/client'
import { products, stockMovements } from '@db/schema'
import { createProduct } from '@products'
import {
  acceptLineCost,
  confirmReceipt,
  createProductFromLine,
  discardLine,
  getReceipt,
  listPendingReceiptLines,
  matchKey,
  normalizeName,
  previewReceipt,
  readExcel,
  rejectLineCost,
  stripSupplierTags,
} from '@receipts'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const PREFIX = 'test-rcp-'
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`
const ALIAS_PREFIX = 'test rcp'

type Cell = string | number | null
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a])

// Arma un .xlsx en memoria: una hoja con las filas dadas.
async function buildXlsx(rows: Cell[][]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Remision')
  for (const row of rows) sheet.addRow(row)
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}
const toFile = (bytes: Uint8Array, name = 'remision.xlsx') => new File([new Uint8Array(bytes)], name)
const HEADER: Cell[] = ['Descripción', 'Cant.', 'Costo unitario']

// Movimientos de remisión del más nuevo al más viejo (revierten saldos), luego renglones,
// remisiones, alias, el resto de movimientos y los productos.
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
  await sql`delete from supplier_product_aliases where normalized_name like ${ALIAS_PREFIX + '%'}`
  const rows = await db.select({ id: products.id }).from(products).where(ilike(products.name, `${PREFIX}%`))
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return
  const movements = await db.select({ id: stockMovements.id }).from(stockMovements)
    .where(inArray(stockMovements.productId, ids)).orderBy(desc(stockMovements.id))
  for (const movement of movements) await db.delete(stockMovements).where(eq(stockMovements.id, movement.id))
  await db.delete(products).where(inArray(products.id, ids))
}

describe('normalizeName (T-41, pura)', () => {
  it('pasa a minúsculas, quita acentos, cambia símbolos por espacio y junta espacios', () => {
    expect(normalizeName('Proteína  WHEY-Gold 2 lb')).toBe('proteina whey gold 2 lb')
  })
  it('recorta extremos y trata la ñ y los puntos como separadores o letras sin marca', () => {
    expect(normalizeName('  Cant.  ')).toBe('cant')
    expect(normalizeName('Piña')).toBe('pina')
  })
  it('devuelve cadena vacía si no hay letras ni dígitos', () => {
    expect(normalizeName(' -- ')).toBe('')
  })
})

describe('stripSupplierTags y matchKey (T-41, puras)', () => {
  it('corta desde el primer * y recorta: «… *CAD 07/27»', () => {
    expect(stripSupplierTags('WHEY GOLD 5 LB *CAD 07/27')).toBe('WHEY GOLD 5 LB')
  })
  it('corta desde la primera comilla recta o tipográfica: «… "NUEVO"»', () => {
    expect(stripSupplierTags('WHEY GOLD "NUEVO"')).toBe('WHEY GOLD')
    expect(stripSupplierTags('WHEY GOLD \u201cNUEVA PRESENTACIÓN\u201d')).toBe('WHEY GOLD')
  })
  it('quita *NUEVO* al final sin tocar el resto', () => {
    expect(stripSupplierTags('RAW CREATINE MONOHYDRATE 250 SERV UNFLAVORED *NUEVO*')).toBe('RAW CREATINE MONOHYDRATE 250 SERV UNFLAVORED')
  })
  it('un nombre que es solo etiqueta queda vacío', () => {
    expect(stripSupplierTags('*OFERTA*')).toBe('')
  })
  it('matchKey es normalizeName de stripSupplierTags', () => {
    expect(matchKey('Proteína  WHEY-Gold *OFERTA*')).toBe('proteina whey gold')
  })
})

describe('readExcel (T-41, puro)', () => {
  it('lee las filas bajo el encabezado y reconoce sinónimos con acentos y puntos', async () => {
    const bytes = await buildXlsx([HEADER, ['Whey', 3, '12.5'], ['Creatina', 2, '$1,200.50']])
    const lines = await readExcel(bytes)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ name: 'Whey' })
    expect(lines[1]).toMatchObject({ name: 'Creatina' })
  })
  it('encuentra el encabezado aunque no sea la primera fila (dentro de las primeras 20)', async () => {
    const bytes = await buildXlsx([['Proveedor X', null, null], [], ['Producto', 'Piezas', 'Precio'], ['Whey', 1, '10']])
    expect(await readExcel(bytes)).toHaveLength(1)
  })
  it('ignora filas vacías y las de total, subtotal, iva y descuento', async () => {
    const bytes = await buildXlsx([HEADER, ['Whey', 1, '10'], [], ['TOTAL', 1, '10'], ['Subtotal', 1, '1'], ['IVA', 1, '1'], ['Descuento', 1, '1']])
    expect(await readExcel(bytes)).toHaveLength(1)
  })
  it('una celda de costo vacía da unitCost null', async () => {
    const bytes = await buildXlsx([HEADER, ['Whey', 1, null]])
    expect((await readExcel(bytes))[0]!.unitCost).toBeNull()
  })
  it('lee el formato del proveedor: usa Precio y Cant. Distribuidor, ignora ENVIO y quita comas del costo', async () => {
    const bytes = await buildXlsx([
      ['Nombre', 'Precio Mayoreo', 'Precio Distribuidor', 'Cant. Mayoreo', 'Cant. Distribuidor', 'Total Mayoreo', 'Total Distribuidor'],
      ['WHEY *OFERTA*', '1,700.00', '1,580.00', 0, 3, '0.00', '4,740.00'],
      ['ENVIO', null, null, null, null, null, '200.00'],
    ])
    const lines = await readExcel(bytes)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ name: 'WHEY *OFERTA*' })
    expect(String(lines[0]!.unitCost).replace(/[$,\s]/g, '')).toBe('1580.00')
    expect(Number(lines[0]!.qty)).toBe(3)
  })
  it('responde 422 si no hay columnas de producto y piezas', async () => {
    const bytes = await buildXlsx([['Foo', 'Bar'], ['a', 'b']])
    await expect(readExcel(bytes)).rejects.toMatchObject({
      code: 'validation', message: 'No encontré las columnas de producto y piezas en la remisión',
    })
  })
})

describe.skipIf(!hasServiceKey)('Recepción de remisiones (T-41, base real)', () => {
  let admin: TestUser
  let seller: TestUser

  const asAdmin = () => ({ userId: admin.id, role: 'admin' })
  const asSeller = () => ({ userId: seller.id, role: 'vendedor' })

  const newProduct = async (label: string, opts: { unitCost?: string; price?: string; qty?: number; active?: boolean } = {}) => {
    const name = productName(label)
    const created = await createProduct({
      name, categoryId: null, price: opts.price ?? '900.00', unitCost: opts.unitCost ?? '12.5000',
      initialQty: opts.qty ?? 5, fractionable: false, portionSize: null, image: null,
    }, admin.id)
    const id = created.id as number
    if (opts.active === false) await db.update(products).set({ active: false }).where(eq(products.id, id))
    return { id, name }
  }

  const stockOf = async (id: number) => (await db.select().from(products).where(eq(products.id, id)))[0]!.stock
  const unitCostOf = async (id: number) => (await db.select().from(products).where(eq(products.id, id)))[0]!.unitCost
  const countAll = async () => {
    const [row] = await sql`select
      (select count(*)::int from supplier_receipts) as receipts,
      (select count(*)::int from supplier_receipt_lines) as lines,
      (select count(*)::int from supplier_product_aliases) as aliases,
      (select count(*)::int from stock_movements) as movements,
      (select coalesce(sum(stock), 0)::int from products) as stock`
    return row!
  }
  const receiptsWith = async (requestId: string) =>
    (await sql`select count(*)::int as n from supplier_receipts where request_id = ${requestId}`)[0]!.n as number
  const movementsOfReceipt = (requestId: string) => sql`
    select m.* from stock_movements m
    join supplier_receipt_lines l on l.id = m.receipt_line_id
    join supplier_receipts r on r.id = l.receipt_id
    where r.request_id = ${requestId} order by m.id`
  const aliasOf = async (readName: string) =>
    (await sql`select product_id from supplier_product_aliases where normalized_name = ${matchKey(readName)}`)[0]?.product_id as number | undefined

  const confirmInput = (lines: { readName: string; qty: number; unitCost: string | null; productId: number | null }[], requestId: string = randomUUID()) =>
    ({ requestId, source: 'excel' as const, fileName: 'remision.xlsx', lines })

  const preview = async (rows: Cell[][]) => previewReceipt(toFile(await buildXlsx([HEADER, ...rows])), asAdmin())

  beforeAll(async () => {
    admin = await createTestUser('rcp-admin', { role: 'admin' })
    seller = await createTestUser('rcp-seller', { role: 'vendedor' })
  })
  afterAll(async () => {
    await cleanupReceipts(admin?.id)
    await cleanupTestData()
    await sql.end({ timeout: 1 }).catch(() => undefined)
  })

  describe('Vista previa', () => {
    it('lee un Excel con tres productos, una fila TOTAL y una vacía: tres lines y nada en skipped', async () => {
      const result = await preview([['uno', 1, '10'], ['dos', 2, '20'], ['tres', 3, '30'], ['TOTAL', 6, '60'], []])
      expect(result.source).toBe('excel')
      expect(result.lines).toHaveLength(3)
      expect(result.skipped).toEqual([])
    })

    it('no escribe remisiones, renglones, alias, movimientos ni cambia el stock', async () => {
      const p = await newProduct('norwrite')
      const before = await countAll()
      await preview([[p.name, 2, '99'], ['desconocido', 1, '5']])
      expect(await countAll()).toEqual(before)
    })

    it('empareja por alias, por nombre sin acentos ni mayúsculas, y deja sin emparejar lo desconocido', async () => {
      const byAlias = await newProduct('alias')
      const byName = await newProduct('nombre')
      const aliasText = `${PREFIX}ALIAS-${Date.now()}`
      await sql`insert into supplier_product_aliases (normalized_name, product_id, updated_by)
        values (${normalizeName(aliasText)}, ${byAlias.id}, ${admin.id})`
      const result = await preview([[aliasText, 1, null], [byName.name.toUpperCase(), 1, null], [`  ${PREFIX}desconocido ${Date.now()}  `, 1, null]])
      expect(result.lines[0]).toMatchObject({ match: 'alias', product: { id: byAlias.id } })
      expect(result.lines[1]).toMatchObject({ match: 'name', product: { id: byName.id } })
      expect(result.lines[2]).toMatchObject({ match: 'none', product: null })
      expect(result.lines[2]!.suggestedName).toMatch(/^test-rcp-desconocido \d+$/)
    })

    it('un nombre igual a un producto desactivado va a skipped con inactive_product', async () => {
      const off = await newProduct('off', { active: false })
      const result = await preview([[off.name, 1, null]])
      expect(result.lines).toEqual([])
      expect(result.skipped[0]).toMatchObject({ reason: 'inactive_product', label: 'Producto desactivado' })
    })

    it('ignora un alias hacia un producto desactivado y empareja por nombre con el activo', async () => {
      const off = await newProduct('aliasoff', { active: false })
      const live = await newProduct('aliaslive')
      await sql`insert into supplier_product_aliases (normalized_name, product_id, updated_by)
        values (${normalizeName(live.name)}, ${off.id}, ${admin.id})`
      const result = await preview([[live.name, 1, null]])
      expect(result.lines[0]).toMatchObject({ match: 'name', product: { id: live.id } })
    })

    it('costChanged solo es true si el costo leído difiere del del producto (12.5 contra 12.5000 es false)', async () => {
      const p = await newProduct('cost', { unitCost: '12.5000' })
      const result = await preview([[p.name, 1, '12.5'], [p.name, 1, '13'], [p.name, 1, null]])
      expect(result.lines.map((l) => l.costChanged)).toEqual([false, true, false])
    })

    it('manda a skipped invalid_qty las piezas 0, -1, 2.5 y abc, e invalid_cost un costo de 5 decimales sin redondear', async () => {
      const result = await preview([['a', 0, '1'], ['b', -1, '1'], ['c', 2.5, '1'], ['d', 'abc', '1'], ['e', 1, '12.34567']])
      expect(result.lines).toEqual([])
      expect(result.skipped.map((s) => s.reason)).toEqual(['invalid_qty', 'invalid_qty', 'invalid_qty', 'invalid_qty', 'invalid_cost'])
    })

    it('manda a skipped missing_name un renglón sin nombre', async () => {
      const result = await preview([[null, 1, '1']])
      expect(result.skipped[0]).toMatchObject({ reason: 'missing_name' })
    })

    it('stock trae before y after por producto y suma dos renglones del mismo producto', async () => {
      const p = await newProduct('sum', { qty: 5 })
      const result = await preview([[p.name, 2, null], [p.name, 3, null]])
      expect(result.stock).toEqual([{ productId: p.id, before: 5, after: 10 }])
    })

    it('responde 422 con un archivo de más de 10 MB', async () => {
      const big = new Uint8Array(10 * 1024 * 1024 + 1)
      big.set([0x50, 0x4b])
      await expect(previewReceipt(toFile(big), asAdmin())).rejects.toMatchObject({ code: 'validation' })
    })

    it.each([
      ['un .xls', new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), 'remision.xls'],
      ['un .csv', new TextEncoder().encode('producto,cantidad\na,1\n'), 'remision.csv'],
      ['una imagen', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'remision.png'],
    ])('responde 422 con %s', async (_label, bytes, name) => {
      await expect(previewReceipt(toFile(bytes, name), asAdmin())).rejects.toMatchObject({
        code: 'validation', message: 'Solo se aceptan remisiones en PDF, Excel (.xlsx) o imagen (JPG o PNG)',
      })
    })

    it('responde 422 con un Excel sin encabezado reconocible', async () => {
      const file = toFile(await buildXlsx([['Foo', 'Bar'], ['a', 1]]))
      await expect(previewReceipt(file, asAdmin())).rejects.toMatchObject({
        code: 'validation', message: 'No encontré las columnas de producto y piezas en la remisión',
      })
    })

    it('responde 422 con más de 200 renglones', async () => {
      const rows: Cell[][] = Array.from({ length: 201 }, (_, i) => [`p${i}`, 1, null])
      await expect(preview(rows)).rejects.toMatchObject({ code: 'validation' })
    })

    it('responde 422 con un PDF de más de 20 páginas, sin llamar al lector', async () => {
      const pages = Array.from({ length: 21 }, () => '<< /Type /Page >>').join('\n')
      const bytes = new TextEncoder().encode(`%PDF-1.4\n${pages}\n`)
      let called = false
      const readPdf = async () => { called = true; return [] }
      await expect(previewReceipt(toFile(bytes, 'r.pdf'), asAdmin(), { readPdf })).rejects.toMatchObject({ code: 'validation' })
      expect(called).toBe(false)
    })

    it('con un readPdf falso de dos renglones válidos y uno con qty null, trae dos lines y un skipped', async () => {
      const readPdf = async () => [
        { position: 1, name: 'uno', qty: 1, unitCost: '10' },
        { position: 2, name: 'dos', qty: 2, unitCost: null },
        { position: 3, name: 'tres', qty: null, unitCost: null },
      ]
      const result = await previewReceipt(toFile(PDF_BYTES, 'r.pdf'), asAdmin(), { readPdf })
      expect(result.source).toBe('pdf')
      expect(result.lines).toHaveLength(2)
      expect(result.skipped).toHaveLength(1)
      expect(result.skipped[0]).toMatchObject({ reason: 'invalid_qty' })
    })

    it('sin ANTHROPIC_API_KEY el lector real responde 500 «La lectura de PDF e imágenes no está configurada»', async () => {
      const saved = process.env.ANTHROPIC_API_KEY
      delete process.env.ANTHROPIC_API_KEY
      try {
        await expect(previewReceipt(toFile(PDF_BYTES, 'r.pdf'), asAdmin())).rejects.toMatchObject({
          code: 'internal', message: 'La lectura de PDF e imágenes no está configurada',
        })
      } finally {
        if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved
      }
    })

    it('formato proveedor: la fila ENVIO no sale ni en lines ni en skipped y Cant. Distribuidor vacía va a invalid_qty', async () => {
      const rows: Cell[][] = [
        ['Nombre', 'Precio Mayoreo', 'Precio Distribuidor', 'Cant. Mayoreo', 'Cant. Distribuidor', 'Total Mayoreo', 'Total Distribuidor'],
        ['uno', '1,700.00', '1,580.00', 0, 2, '0.00', '3,160.00'],
        ['sin surtir', '100.00', '90.00', 0, null, '0.00', '0.00'],
        ['ENVIO', null, null, null, null, null, '200.00'],
      ]
      const result = await previewReceipt(toFile(await buildXlsx(rows)), asAdmin())
      expect(result.lines).toHaveLength(1)
      expect(result.lines[0]).toMatchObject({ readName: 'uno', qty: 2, unitCost: '1580.00' })
      expect(result.skipped).toHaveLength(1)
      expect(result.skipped[0]).toMatchObject({ reason: 'invalid_qty' })
    })

    it('un nombre que es solo etiqueta va a skipped con missing_name', async () => {
      const result = await preview([['*OFERTA*', 1, null]])
      expect(result.skipped[0]).toMatchObject({ reason: 'missing_name' })
    })

    it('empareja por nombre aunque lleve etiqueta: suggestedName sin etiqueta y readName con ella', async () => {
      const p = await newProduct('etiqueta')
      const readName = `${p.name} *OFERTA*`
      const result = await preview([[readName, 1, null]])
      expect(result.lines[0]).toMatchObject({ match: 'name', product: { id: p.id }, readName, suggestedName: p.name })
    })

    it('guarda el alias sin etiqueta y la siguiente remisión con *NUEVO* empareja por alias', async () => {
      const p = await newProduct('aliastag')
      const base = `${PREFIX}distinto-${Date.now()} 2 LB`
      await confirmReceipt(confirmInput([{ readName: `${base} *OFERTA*`, qty: 1, unitCost: null, productId: p.id }]), asAdmin())
      expect(await aliasOf(base)).toBe(p.id)
      const result = await preview([[`${base} *NUEVO*`, 1, null]])
      expect(result.lines[0]).toMatchObject({ match: 'alias', product: { id: p.id } })
    })

    it('lee una imagen JPEG con un readImage falso, recibe image/jpeg y devuelve source image', async () => {
      const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])
      let seenType: string | null = null
      const readImage = async (_bytes: Uint8Array, mediaType: string) => {
        seenType = mediaType
        return [{ position: 1, name: 'uno', qty: 1, unitCost: '10' }, { position: 2, name: 'dos', qty: null, unitCost: null }]
      }
      const result = await previewReceipt(toFile(jpeg, 'r.jpg'), asAdmin(), { readImage })
      expect(seenType).toBe('image/jpeg')
      expect(result.source).toBe('image')
      expect(result.lines).toHaveLength(1)
      expect(result.skipped).toHaveLength(1)
    })

    it('una imagen PNG se lee como image/png', async () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      let seenType: string | null = null
      const readImage = async (_bytes: Uint8Array, mediaType: string) => { seenType = mediaType; return [] }
      await previewReceipt(toFile(png, 'r.png'), asAdmin(), { readImage })
      expect(seenType).toBe('image/png')
    })

    it('responde 422 con una imagen de más de 5 MB', async () => {
      const big = new Uint8Array(5 * 1024 * 1024 + 1)
      big.set([0xff, 0xd8, 0xff])
      await expect(previewReceipt(toFile(big, 'r.jpg'), asAdmin(), { readImage: async () => [] })).rejects.toMatchObject({
        code: 'validation', message: 'La imagen pesa más de 5 MB',
      })
    })

    it.each([
      ['WebP', new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])],
      ['GIF', new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])],
    ])('responde 422 con una imagen %s', async (_label, bytes) => {
      await expect(previewReceipt(toFile(bytes, 'r.img'), asAdmin(), { readImage: async () => [] })).rejects.toMatchObject({
        code: 'validation', message: 'Solo se aceptan remisiones en PDF, Excel (.xlsx) o imagen (JPG o PNG)',
      })
    })

    it('sin ANTHROPIC_API_KEY el lector real de imagen responde 500 «La lectura de PDF e imágenes no está configurada»', async () => {
      const saved = process.env.ANTHROPIC_API_KEY
      delete process.env.ANTHROPIC_API_KEY
      try {
        await expect(previewReceipt(toFile(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'r.jpg'), asAdmin())).rejects.toMatchObject({
          code: 'internal', message: 'La lectura de PDF e imágenes no está configurada',
        })
      } finally {
        if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved
      }
    })

    const realImage = resolve(process.cwd(), '..', 'references', 'WhatsApp Image 2026-07-29 at 10.27.24.jpeg')
    it.skipIf(!process.env.ANTHROPIC_API_KEY || !existsSync(realImage))('lee la remisión real con Claude: al menos 20 renglones con nombre y piezas, ninguno ENVIO', async () => {
      const bytes = new Uint8Array(readFileSync(realImage))
      const result = await previewReceipt(toFile(bytes, 'remision.jpeg'), asAdmin())
      expect(result.source).toBe('image')
      expect(result.lines.length).toBeGreaterThanOrEqual(20)
      for (const line of result.lines) {
        expect(line.readName.length).toBeGreaterThan(0)
        expect(line.qty).toBeGreaterThan(0)
        expect(normalizeName(line.readName)).not.toBe('envio')
      }
    }, 90_000)
  })

  describe('Confirmar', () => {
    it('con dos renglones con producto (uno con costo distinto) y uno sin producto registra entradas, pendientes y alias', async () => {
      const a = await newProduct('ca', { unitCost: '10.0000', qty: 5 })
      const b = await newProduct('cb', { unitCost: '20.0000', qty: 1 })
      const requestId = randomUUID()
      const nameA = `${a.name} remision`
      const nameB = `${b.name} remision`
      const newName = `${PREFIX}nuevo-${Date.now()}`
      const { receipt, replayed } = await confirmReceipt(confirmInput([
        { readName: nameA, qty: 3, unitCost: '10', productId: a.id },
        { readName: nameB, qty: 2, unitCost: '25.5', productId: b.id },
        { readName: newName, qty: 4, unitCost: '7', productId: null },
      ], requestId), asAdmin())
      expect(replayed).toBe(false)
      expect(receipt.lines.map((l) => l.status)).toEqual(['received', 'received', 'pending'])
      expect(receipt.lines.map((l) => l.costStatus)).toEqual([null, 'pending', null])
      const movements = await movementsOfReceipt(requestId)
      expect(movements).toHaveLength(2)
      for (const m of movements) {
        expect(m.type).toBe('purchase')
        expect(m.holder_profile_id).toBeNull()
        expect(m.request_id).toBeNull()
        expect(m.qty).toBeGreaterThan(0)
      }
      expect(await stockOf(a.id)).toBe(8)
      expect(await stockOf(b.id)).toBe(3)
      expect(await unitCostOf(b.id)).toBe('20.0000')
      const [lineB] = await sql`select previous_unit_cost, cost_status from supplier_receipt_lines where id = ${receipt.lines[1]!.id}`
      expect(lineB).toMatchObject({ previous_unit_cost: '20.0000', cost_status: 'pending' })
      expect(await aliasOf(nameA)).toBe(a.id)
      expect(await aliasOf(nameB)).toBe(b.id)
      expect(await aliasOf(newName)).toBeUndefined()
      expect(receipt.units).toEqual(expect.arrayContaining([{ productId: a.id, units: 8 }, { productId: b.id, units: 3 }]))
    })

    it('repetir con el mismo requestId y datos responde replayed true sin más filas; con otros datos, 409', async () => {
      const p = await newProduct('replay', { qty: 1 })
      const input = confirmInput([{ readName: `${p.name} r`, qty: 2, unitCost: '12.5', productId: p.id }])
      await confirmReceipt(input, asAdmin())
      const before = await countAll()
      const again = await confirmReceipt({ ...input, fileName: 'otro.xlsx' }, asAdmin())
      expect(again.replayed).toBe(true)
      expect(await countAll()).toEqual(before)
      await expect(confirmReceipt({ ...input, lines: [{ ...input.lines[0]!, qty: 3 }] }, asAdmin())).rejects.toMatchObject({
        code: 'conflict', message: 'Esta remisión ya se registró con otros datos.',
      })
    })

    it('dos confirmaciones iguales a la vez dejan una sola remisión y una entrada por renglón', async () => {
      const p = await newProduct('conc', { qty: 1 })
      const input = confirmInput([{ readName: `${p.name} c`, qty: 2, unitCost: null, productId: p.id }])
      const results = await Promise.all([confirmReceipt(input, asAdmin()), confirmReceipt(input, asAdmin())])
      expect(results.filter((r) => !r.replayed)).toHaveLength(1)
      expect(await receiptsWith(input.requestId)).toBe(1)
      expect(await movementsOfReceipt(input.requestId)).toHaveLength(1)
      expect(await stockOf(p.id)).toBe(3)
    })

    it('un productId desactivado responde 409 y no deja nada; uno inexistente responde 404', async () => {
      const off = await newProduct('inact', { active: false })
      const live = await newProduct('live')
      const before = await countAll()
      const requestId = randomUUID()
      await expect(confirmReceipt(confirmInput([
        { readName: 'ok', qty: 1, unitCost: null, productId: live.id },
        { readName: 'off', qty: 1, unitCost: null, productId: off.id },
      ], requestId), asAdmin())).rejects.toMatchObject({ code: 'conflict', message: 'El producto está desactivado' })
      expect(await receiptsWith(requestId)).toBe(0)
      expect(await countAll()).toEqual(before)
      await expect(confirmReceipt(confirmInput([
        { readName: 'x', qty: 1, unitCost: null, productId: 2_000_000_000 },
      ]), asAdmin())).rejects.toMatchObject({ code: 'not_found' })
    })

    describe('validaciones 422', () => {
      const line = { readName: 'x', qty: 1, unitCost: null, productId: null }
      const cases: [string, ReturnType<typeof confirmInput>][] = [
        ['qty cero', confirmInput([{ ...line, qty: 0 }])],
        ['qty fuera del máximo', confirmInput([{ ...line, qty: 1_000_000_000 }])],
        ['unitCost con 5 decimales', confirmInput([{ ...line, unitCost: '1.23456' }])],
        ['lines vacío', confirmInput([])],
        ['más de 200 renglones', confirmInput(Array.from({ length: 201 }, () => line))],
        ['readName vacío', confirmInput([{ ...line, readName: '' }])],
        ['requestId que no es UUID', { ...confirmInput([line]), requestId: 'no-uuid' }],
      ]
      it.each(cases)('responde 422 con %s', async (_label, input) => {
        await expect(confirmReceipt(input, asAdmin())).rejects.toMatchObject({ code: 'validation' })
      })
    })

    it('confirmar con otro producto para un nombre que ya tenía alias reemplaza el alias', async () => {
      const first = await newProduct('al1')
      const second = await newProduct('al2')
      const readName = `${PREFIX}mismo-${Date.now()}`
      await confirmReceipt(confirmInput([{ readName, qty: 1, unitCost: null, productId: first.id }]), asAdmin())
      expect(await aliasOf(readName)).toBe(first.id)
      await confirmReceipt(confirmInput([{ readName, qty: 1, unitCost: null, productId: second.id }]), asAdmin())
      expect(await aliasOf(readName)).toBe(second.id)
    })

    it('confirmar admite source image', async () => {
      const p = await newProduct('img')
      const input = { ...confirmInput([{ readName: `${p.name} i`, qty: 1, unitCost: null, productId: p.id }]), source: 'image' as const }
      const { receipt } = await confirmReceipt(input, asAdmin())
      expect(receipt.source).toBe('image')
    })

    it('getReceipt devuelve la remisión con los estados actuales y 404 si no existe', async () => {
      const p = await newProduct('get')
      const input = confirmInput([{ readName: `${p.name} g`, qty: 1, unitCost: null, productId: p.id }])
      await confirmReceipt(input, asAdmin())
      const receipt = await getReceipt(input.requestId, asAdmin())
      expect(receipt).toMatchObject({ requestId: input.requestId, source: 'excel', fileName: 'remision.xlsx' })
      expect(receipt.lines[0]).toMatchObject({ position: 1, status: 'received', product: { id: p.id } })
      await expect(getReceipt(randomUUID(), asAdmin())).rejects.toMatchObject({ code: 'not_found' })
    })
  })

  describe('Pendientes', () => {
    // Remisión con un renglón sin producto y otro con cambio de costo; devuelve ids de renglón.
    const pendingReceipt = async (opts: { unitCost?: string; price?: string; readCost?: string | null } = {}) => {
      const p = await newProduct('pend', { unitCost: opts.unitCost ?? '10.0000', price: opts.price ?? '900.00', qty: 1 })
      const newName = `${PREFIX}pendnuevo-${Date.now()}-${Math.floor(Math.random() * 1e5)}`
      const { receipt } = await confirmReceipt(confirmInput([
        { readName: newName, qty: 4, unitCost: opts.readCost === undefined ? '7' : opts.readCost, productId: null },
        { readName: `${p.name} p`, qty: 2, unitCost: '15', productId: p.id },
      ]), asAdmin())
      return { product: p, newName, newLineId: receipt.lines[0]!.id, costLineId: receipt.lines[1]!.id }
    }

    it('lista el renglón sin producto en newProducts y el cambio de costo en costChanges', async () => {
      const { newLineId, costLineId, product } = await pendingReceipt()
      const pending = await listPendingReceiptLines(asAdmin())
      expect(pending.newProducts.find((l) => l.lineId === newLineId)).toMatchObject({ qty: 4, unitCost: '7.0000' })
      expect(pending.costChanges.find((l) => l.lineId === costLineId)).toMatchObject({
        product: { id: product.id }, qty: 2, currentUnitCost: '10.0000', previousUnitCost: '10.0000', newUnitCost: '15.0000',
      })
    })

    it('dar de alta crea el producto con su entrada, deja el renglón created, guarda el alias y la segunda llamada da 409', async () => {
      const { newLineId, newName } = await pendingReceipt()
      const result = await createProductFromLine(newLineId, { name: productName('alta'), price: '100.00', categoryId: null }, asAdmin())
      expect(result.stock).toEqual({ before: 0, after: 4 })
      expect(await stockOf(result.product.id as number)).toBe(4)
      expect(result.line).toMatchObject({ status: 'created', product: { id: result.product.id } })
      expect(await aliasOf(newName)).toBe(result.product.id)
      await expect(createProductFromLine(newLineId, { name: productName('alta2'), price: '100.00', categoryId: null }, asAdmin()))
        .rejects.toMatchObject({ code: 'conflict', message: 'Este pendiente ya se resolvió.' })
    })

    it('al dar de alta: sin costo da 422, nombre duplicado 409 y precio menor que el costo 422', async () => {
      const noCost = await pendingReceipt({ readCost: null })
      await expect(createProductFromLine(noCost.newLineId, { name: productName('sc'), price: '100.00', categoryId: null }, asAdmin()))
        .rejects.toMatchObject({ code: 'validation', message: 'Falta el costo de fábrica' })
      const dup = await pendingReceipt()
      await expect(createProductFromLine(dup.newLineId, { name: dup.product.name, price: '100.00', categoryId: null }, asAdmin()))
        .rejects.toMatchObject({ code: 'conflict' })
      const low = await pendingReceipt()
      await expect(createProductFromLine(low.newLineId, { name: productName('bajo'), price: '1.00', categoryId: null }, asAdmin()))
        .rejects.toMatchObject({ code: 'validation' })
    })

    it('descartar deja el renglón discarded, sale de newProducts y no mueve inventario', async () => {
      const { newLineId } = await pendingReceipt()
      const before = await countAll()
      const { line } = await discardLine(newLineId, asAdmin())
      expect(line.status).toBe('discarded')
      expect((await countAll()).movements).toBe(before.movements)
      expect((await listPendingReceiptLines(asAdmin())).newProducts.some((l) => l.lineId === newLineId)).toBe(false)
    })

    it('aceptar un costo cambia products.unit_cost y deja el renglón accepted', async () => {
      const { costLineId, product } = await pendingReceipt()
      const result = await acceptLineCost(costLineId, asAdmin())
      expect(result.line.costStatus).toBe('accepted')
      expect(result.product).toMatchObject({ id: product.id, unitCost: '15.0000' })
      expect(await unitCostOf(product.id)).toBe('15.0000')
    })

    it('aceptar con precio menor que el costo nuevo da 422 y con el producto desactivado da 409', async () => {
      const low = await pendingReceipt({ unitCost: '10.0000', price: '12.00' })
      await expect(acceptLineCost(low.costLineId, asAdmin())).rejects.toMatchObject({
        code: 'validation', message: 'El precio de venta es menor que el costo nuevo; edita el precio primero',
      })
      const off = await pendingReceipt()
      await db.update(products).set({ active: false }).where(eq(products.id, off.product.id))
      await expect(acceptLineCost(off.costLineId, asAdmin())).rejects.toMatchObject({ code: 'conflict' })
    })

    it('rechazar un costo deja el renglón rejected y no cambia products.unit_cost', async () => {
      const { costLineId, product } = await pendingReceipt()
      const { line } = await rejectLineCost(costLineId, asAdmin())
      expect(line.costStatus).toBe('rejected')
      expect(await unitCostOf(product.id)).toBe('10.0000')
    })
  })

  describe('Permisos', () => {
    it('un vendedor recibe 403 en cada caso de uso', async () => {
      const forbidden = { code: 'forbidden' }
      await expect(previewReceipt(toFile(await buildXlsx([HEADER, ['a', 1, null]])), asSeller())).rejects.toMatchObject(forbidden)
      await expect(confirmReceipt(confirmInput([{ readName: 'x', qty: 1, unitCost: null, productId: null }]), asSeller())).rejects.toMatchObject(forbidden)
      await expect(getReceipt(randomUUID(), asSeller())).rejects.toMatchObject(forbidden)
      await expect(listPendingReceiptLines(asSeller())).rejects.toMatchObject(forbidden)
      await expect(createProductFromLine(1, { name: 'x', price: '1.00', categoryId: null }, asSeller())).rejects.toMatchObject(forbidden)
      await expect(discardLine(1, asSeller())).rejects.toMatchObject(forbidden)
      await expect(acceptLineCost(1, asSeller())).rejects.toMatchObject(forbidden)
      await expect(rejectLineCost(1, asSeller())).rejects.toMatchObject(forbidden)
    })
  })
})
