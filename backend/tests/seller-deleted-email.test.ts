import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE as deleteRoute } from '@api/sellers/[id]/route'
import { db } from '@db/client'
import { products, profiles, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { sendSellerDeletedEmail } from '@notifications'
import { insertMovements, type NewStockMovement } from '@stock'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

// Aviso por correo al eliminar a un vendedor (spec M13-t44). `fetch` se reemplaza: nunca sale un
// correo real. Lo que no es de Resend (Supabase Auth) pasa al `fetch` verdadero, salvo los casos que
// simulan una falla de Auth.
const RESEND_URL = 'https://api.resend.com/emails'
const TEMPLATE_ID = 'plantilla-eliminacion-123'
const API_KEY = 're_clave_de_prueba'
const FROM = 'Mammut <avisos@ejemplo.test>'
const ENV_KEYS = ['RESEND_API_KEY', 'RESEND_FROM', 'RESEND_TEMPLATE_SELLER_DELETE'] as const
const TO = 'victor.vendedor@ejemplo.test'

const TEXTS = {
  headline: 'Tu cuenta de Mammut fue eliminada',
  message: 'Tu usuario en Mammut fue eliminado y ya no podrás entrar a la app.',
  archivedNote: 'Tu historial de ventas se conserva.',
  purgedNote: 'Ya no hay datos tuyos en la app.',
} as const

interface ResendCall {
  url: string
  init: RequestInit
  body: Record<string, unknown>
}

const realFetch = globalThis.fetch
let resendCalls: ResendCall[] = []
type ResendReply = () => Promise<Response>
let resendReply: ResendReply = async () => new Response('{"id":"x"}', { status: 200 })
// Permite que cada prueba intercepte las llamadas a Auth; devuelve `undefined` para dejar pasar.
type AuthHook = (url: string, init: RequestInit | undefined) => Promise<Response | undefined>
let authHook: AuthHook = async () => undefined

const urlOf = (input: RequestInfo | URL) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)

function stubFetch() {
  resendCalls = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input)
    if (url !== RESEND_URL) {
      const intercepted = await authHook(url, init)
      return intercepted ?? realFetch(input, init)
    }
    resendCalls.push({ url, init: init ?? {}, body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> })
    return resendReply()
  })
}

const saved: Record<string, string | undefined> = {}
function setEmailEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}) {
  const values = { RESEND_API_KEY: API_KEY, RESEND_FROM: FROM, RESEND_TEMPLATE_SELLER_DELETE: TEMPLATE_ID, ...overrides }
  for (const key of ENV_KEYS) {
    if (values[key] === undefined) delete process.env[key]
    else process.env[key] = values[key]
  }
}

beforeAll(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key]
})

beforeEach(() => {
  resendReply = async () => new Response('{"id":"x"}', { status: 200 })
  authHook = async () => undefined
  stubFetch()
  setEmailEnv()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

const variablesOf = (call: ResendCall) => (call.body.template as { variables: Record<string, string> }).variables

describe('sendSellerDeletedEmail: la petición a Resend', () => {
  it('borrado: manda asunto y las cuatro variables con la nota «Ya no hay datos tuyos en la app.»', async () => {
    const status = await sendSellerDeletedEmail({ to: TO, name: 'Víctor Vendedor', kind: 'purged' })
    expect(status).toBe('sent')
    expect(resendCalls).toHaveLength(1)
    const call = resendCalls[0]!
    expect(call.body.subject).toBe(TEXTS.headline)
    expect(call.body.to).toBe(TO)
    expect((call.body.template as { id: string }).id).toBe(TEMPLATE_ID)
    expect(variablesOf(call)).toEqual({
      NAME: 'Víctor Vendedor',
      HEADLINE: TEXTS.headline,
      MESSAGE: TEXTS.message,
      NOTE: TEXTS.purgedNote,
    })
  })

  it('archivado: la nota es «Tu historial de ventas se conserva.»', async () => {
    await sendSellerDeletedEmail({ to: TO, name: 'Víctor Vendedor', kind: 'archived' })
    expect(variablesOf(resendCalls[0]!).NOTE).toBe(TEXTS.archivedNote)
  })

  it('el id de la plantilla sale de RESEND_TEMPLATE_SELLER_DELETE', async () => {
    setEmailEnv({ RESEND_TEMPLATE_SELLER_DELETE: 'otra-plantilla-999' })
    await sendSellerDeletedEmail({ to: TO, name: 'Ana', kind: 'purged' })
    expect((resendCalls[0]!.body.template as { id: string }).id).toBe('otra-plantilla-999')
  })

  it('escapa para HTML el nombre en NAME, una sola vez', async () => {
    await sendSellerDeletedEmail({ to: TO, name: 'Ana <b>&</b> "Co"', kind: 'purged' })
    expect(variablesOf(resendCalls[0]!).NAME).toBe('Ana &lt;b&gt;&amp;&lt;/b&gt; &quot;Co&quot;')
  })

  it('ningún texto lleva enlaces', async () => {
    for (const kind of ['archived', 'purged'] as const) {
      resendCalls = []
      await sendSellerDeletedEmail({ to: TO, name: 'Ana', kind })
      expect(JSON.stringify(resendCalls[0]!.body)).not.toMatch(/https?:\/\/|www\./i)
    }
  })

  it.each(ENV_KEYS)('sin %s da «skipped» y no llama a fetch', async (key) => {
    setEmailEnv({ [key]: undefined })
    expect(await sendSellerDeletedEmail({ to: TO, name: 'Ana', kind: 'purged' })).toBe('skipped')
    expect(resendCalls).toHaveLength(0)
  })

  it.each([null, ''])('sin correo del vendedor (%j) da «skipped» y no llama a fetch', async (to) => {
    expect(await sendSellerDeletedEmail({ to, name: 'Ana', kind: 'purged' })).toBe('skipped')
    expect(resendCalls).toHaveLength(0)
  })

  it('una respuesta 500 es «failed» sin lanzar y el log no incluye el correo', async () => {
    resendReply = async () => new Response('{"message":"error"}', { status: 500 })
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await sendSellerDeletedEmail({ to: TO, name: 'Ana', kind: 'archived' })).toBe('failed')
    expect(log).toHaveBeenCalled()
    expect(JSON.stringify(log.mock.calls.map((args) => args.map((arg) => (arg instanceof Error ? arg.message : arg))))).not.toContain(TO)
  })
})

// Productos de prueba con prefijo propio, para limpiarlos sin tocar el catálogo.
const PREFIX = 'test-deleted-mail-'
const request = (token?: string) =>
  new Request('http://api.test/api/sellers', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000abcd'

async function cleanupStock() {
  const rows = await db.select({ id: products.id }).from(products).where(ilike(products.name, `${PREFIX}%`))
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return
  const movements = await db.select({ id: stockMovements.id }).from(stockMovements)
    .where(inArray(stockMovements.productId, ids)).orderBy(desc(stockMovements.id))
  for (const movement of movements) await db.delete(stockMovements).where(eq(stockMovements.id, movement.id))
  await db.delete(vendorStock).where(inArray(vendorStock.productId, ids))
  await db.delete(products).where(inArray(products.id, ids))
}

describe.skipIf(!hasServiceKey)('Aviso por correo al eliminar (spec M13-t44, con cuentas reales)', () => {
  let admin: TestUser
  let product: number

  const newSeller = (label: string, active = true) => createTestUser(label, { role: 'vendedor', active })
  const remove = (id: string, token = admin.token) => deleteRoute(request(token), ctx(id))
  const profileOf = async (id: string) => (await db.select().from(profiles).where(eq(profiles.id, id)))[0]
  // Un solo movimiento del vendedor basta para que tenga historial (se archiva en vez de borrarse).
  const giveHistory = (holder: string, qty: number, returnAll: boolean) =>
    withTransaction(async (tx) => {
      const rows: NewStockMovement[] = [
        { productId: product, type: 'delivery', qty: -qty, holderProfileId: null, createdBy: admin.id },
        { productId: product, type: 'delivery', qty, holderProfileId: holder, createdBy: admin.id },
      ]
      if (returnAll) {
        rows.push(
          { productId: product, type: 'return', qty, holderProfileId: null, createdBy: admin.id },
          { productId: product, type: 'return', qty: -qty, holderProfileId: holder, createdBy: admin.id },
        )
      }
      await insertMovements(tx, rows)
    })

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    admin = await createTestUser('t44-admin', { role: 'admin' })
    const [row] = await db.insert(products)
      .values({ name: `${PREFIX}whey-${Date.now()}`, price: '100', unitCost: '50' }).returning()
    product = row!.id
    await withTransaction((tx) =>
      insertMovements(tx, [{ productId: product, type: 'initial', qty: 50, holderProfileId: null, createdBy: admin.id }]),
    )
  })

  afterAll(async () => {
    await cleanupStock()
    await cleanupTestData()
  })

  it('sin movimientos: una petición con la plantilla, el correo original, el asunto y «Ya no hay datos tuyos en la app.»', async () => {
    const target = await newSeller('t44-borrado')
    const res = await remove(target.id)
    expect(res.status).toBe(204)
    expect(await profileOf(target.id)).toBeUndefined()
    expect(resendCalls).toHaveLength(1)
    const call = resendCalls[0]!
    expect((call.body.template as { id: string }).id).toBe(TEMPLATE_ID)
    expect(call.body.to).toBe(target.email)
    expect(call.body.subject).toBe(TEXTS.headline)
    expect(variablesOf(call)).toEqual({
      NAME: 'Prueba t44-borrado',
      HEADLINE: TEXTS.headline,
      MESSAGE: TEXTS.message,
      NOTE: TEXTS.purgedNote,
    })
  })

  it('con historial y sin piezas se archiva: una petición con «Tu historial de ventas se conserva.» al correo original', async () => {
    const target = await newSeller('t44-archivado')
    await giveHistory(target.id, 2, true)
    const res = await remove(target.id)
    expect(res.status).toBe(204)
    expect((await profileOf(target.id))?.archivedAt).not.toBeNull()
    expect(resendCalls).toHaveLength(1)
    const call = resendCalls[0]!
    expect(call.body.to).toBe(target.email)
    expect(String(call.body.to)).not.toMatch(/^archivado-.*@mammut\.invalid$/)
    expect(variablesOf(call).NOTE).toBe(TEXTS.archivedNote)
  })

  it('un nombre con HTML llega escapado, sin doble escape', async () => {
    const target = await newSeller('t44-nombre')
    await db.update(profiles).set({ fullName: 'Ana <b>&</b> "Co"' }).where(eq(profiles.id, target.id))
    expect((await remove(target.id)).status).toBe(204)
    expect(variablesOf(resendCalls[0]!).NAME).toBe('Ana &lt;b&gt;&amp;&lt;/b&gt; &quot;Co&quot;')
  })

  it('un vendedor ya desactivado también recibe el aviso', async () => {
    const target = await newSeller('t44-inactivo', false)
    expect((await remove(target.id)).status).toBe(204)
    expect(resendCalls).toHaveLength(1)
    expect(resendCalls[0]!.body.to).toBe(target.email)
  })

  it('con piezas a su cargo da 409 y no manda correo', async () => {
    const target = await newSeller('t44-con-piezas')
    await giveHistory(target.id, 2, false)
    expect((await remove(target.id)).status).toBe(409)
    expect(resendCalls).toHaveLength(0)
  })

  it('con un id inexistente da 404 y no manda correo', async () => {
    expect((await remove(UNKNOWN_ID)).status).toBe(404)
    expect(resendCalls).toHaveLength(0)
  })

  it('un vendedor ya archivado da 404 y no manda correo', async () => {
    const target = await newSeller('t44-ya-archivado')
    await giveHistory(target.id, 1, true)
    expect((await remove(target.id)).status).toBe(204)
    resendCalls = []
    expect((await remove(target.id)).status).toBe(404)
    expect(resendCalls).toHaveLength(0)
  })

  it('si Auth falla al liberar el correo y el archivado se deshace, no manda correo', async () => {
    const target = await newSeller('t44-auth-falla')
    await giveHistory(target.id, 1, true)
    authHook = async (url, init) =>
      url.includes(`/auth/v1/admin/users/${target.id}`) && init?.method === 'PUT'
        ? new Response('{"msg":"fallo"}', { status: 500, headers: { 'content-type': 'application/json' } })
        : undefined
    const res = await remove(target.id)
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect((await profileOf(target.id))?.archivedAt).toBeNull()
    expect(resendCalls).toHaveLength(0)
  })

  it('el aviso sale después de confirmar: al llamar a Resend el vendedor ya no existe', async () => {
    const target = await newSeller('t44-despues')
    let existedAtSend: boolean | undefined
    resendReply = async () => {
      existedAtSend = (await profileOf(target.id)) !== undefined
      return new Response('{"id":"x"}', { status: 200 })
    }
    await remove(target.id)
    expect(existedAtSend).toBe(false)
  })

  it('con Resend respondiendo 500 la eliminación queda aplicada y responde 204', async () => {
    resendReply = async () => new Response('{"message":"error"}', { status: 500 })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const target = await newSeller('t44-resend-500')
    expect((await remove(target.id)).status).toBe(204)
    expect(await profileOf(target.id)).toBeUndefined()
    expect(resendCalls).toHaveLength(1)
  })

  it('sin RESEND_TEMPLATE_SELLER_DELETE elimina, responde 204 y no hace ninguna petición', async () => {
    setEmailEnv({ RESEND_TEMPLATE_SELLER_DELETE: undefined })
    const target = await newSeller('t44-sin-plantilla')
    expect((await remove(target.id)).status).toBe(204)
    expect(await profileOf(target.id)).toBeUndefined()
    expect(resendCalls).toHaveLength(0)
  })

  it('un vendedor sin correo se elimina igual y no hay petición a Resend', async () => {
    const target = await newSeller('t44-sin-correo')
    authHook = async (url, init) => {
      if (!url.includes(`/auth/v1/admin/users/${target.id}`) || (init?.method ?? 'GET') !== 'GET') return undefined
      const real = await realFetch(url, init)
      const user = (await real.json()) as Record<string, unknown>
      return new Response(JSON.stringify({ ...user, email: '' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    expect((await remove(target.id)).status).toBe(204)
    expect(await profileOf(target.id)).toBeUndefined()
    expect(resendCalls).toHaveLength(0)
  })
})
