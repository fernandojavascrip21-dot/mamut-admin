import { randomUUID } from 'node:crypto'
import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as loginRoute } from '@api/auth/login/route'
import { POST as deactivateRoute } from '@api/sellers/[id]/deactivate/route'
import { PUT as passwordRoute } from '@api/sellers/[id]/password/route'
import { POST as reactivateRoute } from '@api/sellers/[id]/reactivate/route'
import { DELETE as deleteRoute, GET as getSellerRoute, PUT as updateRoute } from '@api/sellers/[id]/route'
import { GET as listRoute, POST as createRoute } from '@api/sellers/route'
import { getBusinessCut } from '@cuts'
import { db, sql } from '@db/client'
import { directSales, products, profiles, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { supabaseAdmin } from '@lib/supabase'
import { createSale } from '@sales'
import { insertMovements, type NewStockMovement } from '@stock'
import {
  cleanupTestData,
  createTestUser,
  hasServiceKey,
  TEST_PASSWORD,
  TEST_PREFIX,
  TEST_SELLER_PHONE,
  type TestUser,
} from './helpers/users'

// Archivar al eliminar un vendedor con historial (spec M13-hu45 §10). `fetch` se reemplaza: nunca
// sale un correo real; lo que no es de Resend (ni la falla simulada de Auth) pasa al `fetch` verdadero.
const PREFIX = 'test-archive-'
const RESEND_URL = 'https://api.resend.com/emails'
const ENV_KEYS = ['RESEND_API_KEY', 'RESEND_FROM', 'RESEND_TEMPLATE_SELLER_STATUS', 'RESEND_TEMPLATE_SELLER_PASSWORD'] as const
const productName = (label: string) => `${PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`

const realFetch = globalThis.fetch
let resendCalls: string[] = []
let failAuthEmailUpdateFor: string | null = null
const urlOf = (input: RequestInfo | URL) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)

const request = (method: string, token: string, opts: { body?: unknown; query?: string } = {}) =>
  new Request(`http://api.test/api/sellers${opts.query ?? ''}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const json = async (res: Response) => (await res.json()) as Record<string, unknown>
const errorMessage = async (res: Response) => ((await json(res)).error as { message: string }).message
const tryLogin = (email: string) =>
  loginRoute(new Request('http://api.test/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  }), undefined)

interface ArchiveRow { archived_at: string | null; active: boolean; archived_email: string | null }
const archiveRow = async (id: string) => {
  const rows = await sql<ArchiveRow[]>`select archived_at, active, archived_email from profiles where id = ${id}`
  return rows[0]
}
const movementCount = async (id: string) => {
  const rows = await sql<{ n: number }[]>`select count(*)::int as n from stock_movements where holder_profile_id = ${id}`
  return rows[0]!.n
}
const authEmail = async (id: string) => (await supabaseAdmin().auth.admin.getUserById(id)).data.user?.email

// Los vendedores archivados cambian de correo en Auth y ya no los encuentra cleanupTestData: se
// rastrean por id y se purgan aquí (ventas, movimientos, perfil y cuenta de Auth).
const tracked: string[] = []
async function purgeTracked() {
  const stale = await sql<{ id: string }[]>`select id from profiles where archived_email like ${`${TEST_PREFIX}%`}`
  const ids = [...new Set([...tracked, ...stale.map((row) => row.id)])]
  if (ids.length > 0) {
    const sales = await db.select({ id: directSales.id }).from(directSales).where(inArray(directSales.soldBy, ids))
    const saleIds = sales.map((sale) => sale.id)
    if (saleIds.length > 0) {
      const sold = await db.select({ id: stockMovements.id }).from(stockMovements)
        .where(inArray(stockMovements.directSaleId, saleIds)).orderBy(desc(stockMovements.id))
      for (const movement of sold) await db.delete(stockMovements).where(eq(stockMovements.id, movement.id))
      await db.delete(directSales).where(inArray(directSales.id, saleIds))
    }
  }
  const rows = await db.select({ id: products.id }).from(products).where(ilike(products.name, `${PREFIX}%`))
  const productIds = rows.map((row) => row.id)
  if (productIds.length > 0) {
    const movements = await db.select({ id: stockMovements.id }).from(stockMovements)
      .where(inArray(stockMovements.productId, productIds)).orderBy(desc(stockMovements.id))
    for (const movement of movements) await db.delete(stockMovements).where(eq(stockMovements.id, movement.id))
    await db.delete(vendorStock).where(inArray(vendorStock.productId, productIds))
    await db.delete(products).where(inArray(products.id, productIds))
  }
  for (const id of ids) {
    await db.delete(profiles).where(eq(profiles.id, id))
    await supabaseAdmin().auth.admin.deleteUser(id)
  }
}

describe.skipIf(!hasServiceKey)('Archivar al eliminar un vendedor con historial (M13-hu45 §10, con cuentas reales)', () => {
  let admin: TestUser
  let product: number
  const saved: Record<string, string | undefined> = {}

  const move = (rows: Omit<NewStockMovement, 'createdBy'>[]) =>
    withTransaction((tx) => insertMovements(tx, rows.map((row) => ({ ...row, createdBy: admin.id }))))
  const deliver = (holder: string, qty: number) =>
    move([
      { productId: product, type: 'delivery', qty: -qty, holderProfileId: null },
      { productId: product, type: 'delivery', qty, holderProfileId: holder },
    ])
  const takeBack = (holder: string, qty: number) =>
    move([
      { productId: product, type: 'return', qty, holderProfileId: null },
      { productId: product, type: 'return', qty: -qty, holderProfileId: holder },
    ])
  const newSeller = async (label: string) => {
    const user = await createTestUser(label, { role: 'vendedor' })
    tracked.push(user.id)
    return user
  }
  // Vendedor con historial (una entrega y su retiro) y sin piezas a su cargo.
  const sellerWithHistory = async (label: string) => {
    const user = await newSeller(label)
    await deliver(user.id, 2)
    await takeBack(user.id, 2)
    return user
  }
  const remove = (id: string) => deleteRoute(request('DELETE', admin.token), ctx(id))

  beforeAll(async () => {
    for (const key of ENV_KEYS) saved[key] = process.env[key]
    await purgeTracked()
    await cleanupTestData()
    admin = await createTestUser('m45-admin', { role: 'admin' })
    const [row] = await db.insert(products).values({ name: productName('whey'), price: '100', unitCost: '50' }).returning()
    product = row!.id
    await move([{ productId: product, type: 'initial', qty: 100, holderProfileId: null }])
  }, 60_000)

  beforeEach(() => {
    resendCalls = []
    failAuthEmailUpdateFor = null
    process.env.RESEND_API_KEY = 're_clave_de_prueba'
    process.env.RESEND_FROM = 'Mammut <avisos@ejemplo.test>'
    process.env.RESEND_TEMPLATE_SELLER_STATUS = 'plantilla-de-prueba'
    process.env.RESEND_TEMPLATE_SELLER_PASSWORD = 'plantilla-de-prueba'
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input)
      if (url === RESEND_URL) {
        resendCalls.push(url)
        return new Response('{"id":"x"}', { status: 200 })
      }
      if (failAuthEmailUpdateFor && init?.method === 'PUT' && url.includes(`/auth/v1/admin/users/${failAuthEmailUpdateFor}`)) {
        return new Response(JSON.stringify({ message: 'fallo simulado' }), { status: 500, headers: { 'content-type': 'application/json' } })
      }
      return realFetch(input, init)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  afterAll(async () => {
    await purgeTracked()
    await cleanupTestData()
    await sql.end()
  }, 60_000)

  describe('archivar', () => {
    it('con historial y sin piezas responde 204, deja archived_at, active false y archived_email, y libera el correo en Auth', async () => {
      const target = await sellerWithHistory('m45-archivar')
      const res = await remove(target.id)
      expect(res.status).toBe(204)
      const row = await archiveRow(target.id)
      expect(row?.archived_at).not.toBeNull()
      expect(row?.active).toBe(false)
      expect(row?.archived_email).toBe(target.email)
      expect(await authEmail(target.id)).toBe(`archivado-${target.id}@mammut.invalid`)
    })

    it('no toca el historial: sus cuatro movimientos siguen en la base', async () => {
      const target = await sellerWithHistory('m45-historial')
      const before = await movementCount(target.id)
      expect(before).toBe(2)
      expect((await remove(target.id)).status).toBe(204)
      expect(await movementCount(target.id)).toBe(before)
    })

    it('no manda ningún correo por Resend', async () => {
      const target = await sellerWithHistory('m45-sin-correo')
      expect((await remove(target.id)).status).toBe(204)
      expect(resendCalls).toHaveLength(0)
    })

    it('con piezas a su cargo da 409 con el mensaje de desactivar y no archiva nada', async () => {
      const target = await newSeller('m45-con-piezas')
      await deliver(target.id, 3)
      const res = await remove(target.id)
      expect(res.status).toBe(409)
      expect(await errorMessage(res)).toBe('Retírale sus piezas antes de desactivarlo')
      const row = await archiveRow(target.id)
      expect(row?.archived_at).toBeNull()
      expect(row?.active).toBe(true)
      expect(await authEmail(target.id)).toBe(target.email)
    })

    it('sin movimientos se borra por completo: perfil y cuenta de Auth, sin rastro archivado', async () => {
      const target = await newSeller('m45-sin-movimientos')
      expect((await remove(target.id)).status).toBe(204)
      expect(await archiveRow(target.id)).toBeUndefined()
      expect((await supabaseAdmin().auth.admin.getUserById(target.id)).data.user).toBeNull()
      expect(resendCalls).toHaveLength(0)
    })

    it('si Auth falla al liberar el correo, el vendedor sigue activo y sin archivar y la petición da error', async () => {
      const target = await sellerWithHistory('m45-auth-falla')
      failAuthEmailUpdateFor = target.id
      const res = await remove(target.id)
      expect(res.status).toBeGreaterThanOrEqual(500)
      failAuthEmailUpdateFor = null
      const row = await archiveRow(target.id)
      expect(row?.archived_at).toBeNull()
      expect(row?.active).toBe(true)
      expect(row?.archived_email).toBeNull()
      expect(await authEmail(target.id)).toBe(target.email)
      expect(await movementCount(target.id)).toBe(2)
    })
  })

  describe('un archivado', () => {
    it('no sale en la lista de activos ni en la de desactivados', async () => {
      const target = await sellerWithHistory('m45-listas')
      expect((await remove(target.id)).status).toBe(204)
      for (const query of ['', '?status=inactive']) {
        const res = await listRoute(request('GET', admin.token, { query }), undefined)
        expect(res.status).toBe(200)
        const rows = (await res.json()) as { id: string }[]
        expect(rows.some((row) => row.id === target.id)).toBe(false)
      }
    })

    it('su detalle da 404, también con ?status=any', async () => {
      const target = await sellerWithHistory('m45-detalle')
      expect((await remove(target.id)).status).toBe(204)
      expect((await getSellerRoute(request('GET', admin.token), ctx(target.id))).status).toBe(404)
      expect((await getSellerRoute(request('GET', admin.token, { query: '?status=any' }), ctx(target.id))).status).toBe(404)
    })

    it('cualquier operación sobre él da 404: editar, desactivar, reactivar, contraseña y eliminar de nuevo', async () => {
      const target = await sellerWithHistory('m45-operaciones')
      expect((await remove(target.id)).status).toBe(204)
      const body = { fullName: 'Otro', businessName: null, phone: TEST_SELLER_PHONE, email: `${TEST_PREFIX}otro-${Date.now()}@example.com` }
      expect((await updateRoute(request('PUT', admin.token, { body }), ctx(target.id))).status).toBe(404)
      expect((await deactivateRoute(request('POST', admin.token), ctx(target.id))).status).toBe(404)
      expect((await reactivateRoute(request('POST', admin.token), ctx(target.id))).status).toBe(404)
      expect((await passwordRoute(request('PUT', admin.token, { body: { password: 'Nueva-Clave-987!' } }), ctx(target.id))).status).toBe(404)
      expect((await remove(target.id)).status).toBe(404)
    })

    it('no puede iniciar sesión, ni con su correo original ni con el interno', async () => {
      const target = await sellerWithHistory('m45-login')
      expect((await remove(target.id)).status).toBe(204)
      expect((await tryLogin(target.email)).status).toBe(401)
      expect((await tryLogin(`archivado-${target.id}@mammut.invalid`)).status).toBe(401)
    })

    it('sus ventas siguen contando en el resumen del negocio y en «Por titular»', async () => {
      const date = '2017-04-01'
      const target = await newSeller('m45-corte')
      const [sold] = await db.insert(products).values({ name: productName('corte'), price: '920', unitCost: '600' }).returning()
      const productId = sold!.id
      await move([
        { productId, type: 'initial', qty: 5, holderProfileId: null },
        { productId, type: 'delivery', qty: -5, holderProfileId: null },
        { productId, type: 'delivery', qty: 5, holderProfileId: target.id },
      ])
      const { sale } = await createSale(
        { requestId: randomUUID(), holderId: target.id, lines: [{ productId, qty: 2 }] },
        { userId: admin.id, role: 'admin' },
      )
      await db.update(directSales).set({ soldAt: `${date}T18:00:00Z` }).where(eq(directSales.id, sale.id))
      await move([
        { productId, type: 'return', qty: 3, holderProfileId: null },
        { productId, type: 'return', qty: -3, holderProfileId: target.id },
      ])

      const before = await getBusinessCut({ period: 'day', date }, { userId: admin.id, role: 'admin' })
      expect((await remove(target.id)).status).toBe(204)
      const after = await getBusinessCut({ period: 'day', date }, { userId: admin.id, role: 'admin' })

      expect(after.totals).toEqual(before.totals)
      expect(after.totals).toMatchObject({ salesCount: 1, units: 2, total: '1840.00' })
      expect(after.holders.find((row) => row.holder?.id === target.id)).toMatchObject({ total: '1840.00' })
    })
  })

  describe('volver a dar de alta con el mismo correo y teléfono', () => {
    it('crea un vendedor nuevo (otro id, sin historial) y el archivado conserva el suyo', async () => {
      const target = await sellerWithHistory('m45-realta')
      expect((await remove(target.id)).status).toBe(204)
      const res = await createRoute(
        request('POST', admin.token, {
          body: { email: target.email, password: TEST_PASSWORD, fullName: 'Vendedor nuevo', phone: TEST_SELLER_PHONE },
        }),
        undefined,
      )
      expect(res.status).toBe(201)
      const created = await json(res)
      expect(created.id).not.toBe(target.id)
      expect(created.email).toBe(target.email)
      expect(await movementCount(created.id as string)).toBe(0)
      expect(await movementCount(target.id)).toBe(2)
      expect((await archiveRow(target.id))?.archived_at).not.toBeNull()
      expect((await tryLogin(target.email)).status).toBe(200)
    })
  })
})
