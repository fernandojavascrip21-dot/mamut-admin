import { desc, eq, ilike, inArray } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as deactivateRoute } from '@api/sellers/[id]/deactivate/route'
import { POST as reactivateRoute } from '@api/sellers/[id]/reactivate/route'
import { DELETE as deleteRoute } from '@api/sellers/[id]/route'
import { db } from '@db/client'
import { products, profiles, stockMovements, vendorStock } from '@db/schema'
import { withTransaction } from '@db/transaction'
import { sendSellerStatusEmail } from '@notifications'
import { insertMovements, type NewStockMovement } from '@stock'
import { cleanupTestData, createTestUser, hasServiceKey, TEST_PREFIX, type TestUser } from './helpers/users'

// Avisos por correo al desactivar y reactivar (spec M13-hu44). `fetch` se reemplaza: nunca sale un
// correo real. Lo que no es de Resend (Supabase Auth, que usan las pruebas con base real) pasa al
// `fetch` verdadero.
const RESEND_URL = 'https://api.resend.com/emails'
const TEMPLATE_ID = 'plantilla-de-prueba-123'
const API_KEY = 're_clave_de_prueba'
const FROM = 'Mammut <avisos@ejemplo.test>'
const ENV_KEYS = ['RESEND_API_KEY', 'RESEND_FROM', 'RESEND_TEMPLATE_SELLER_STATUS'] as const
const TO = 'victor.vendedor@ejemplo.test'

const TEXTS = {
  deactivated: {
    headline: 'Tu acceso a Mammut fue desactivado',
    message: 'Tu usuario en Mammut fue desactivado y ya no podrás entrar a la app.',
    note: 'Tu historial de ventas se conserva.',
  },
  reactivated: {
    headline: 'Tu acceso a Mammut fue reactivado',
    message: 'Tu usuario en Mammut fue reactivado. Ya puedes entrar a la app.',
    note: 'Entra con tu correo y tu contraseña de siempre.',
  },
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

const urlOf = (input: RequestInfo | URL) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)

function stubResend() {
  resendCalls = []
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input)
    if (url !== RESEND_URL) return realFetch(input, init)
    resendCalls.push({ url, init: init ?? {}, body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> })
    return resendReply()
  })
}

const saved: Record<string, string | undefined> = {}
function setEmailEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}) {
  const values = { RESEND_API_KEY: API_KEY, RESEND_FROM: FROM, RESEND_TEMPLATE_SELLER_STATUS: TEMPLATE_ID, ...overrides }
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
  stubResend()
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

describe('sendSellerStatusEmail: la petición a Resend', () => {
  it('desactivado: manda asunto y las cuatro variables con los textos de la tabla', async () => {
    const status = await sendSellerStatusEmail({ to: TO, name: 'Víctor Vendedor', kind: 'deactivated' })
    expect(status).toBe('sent')
    expect(resendCalls).toHaveLength(1)
    const call = resendCalls[0]!
    expect(call.body.subject).toBe(TEXTS.deactivated.headline)
    expect(variablesOf(call)).toEqual({
      NAME: 'Víctor Vendedor',
      HEADLINE: TEXTS.deactivated.headline,
      MESSAGE: TEXTS.deactivated.message,
      NOTE: TEXTS.deactivated.note,
    })
  })

  it('reactivado: manda asunto y las cuatro variables con los textos de la tabla', async () => {
    const status = await sendSellerStatusEmail({ to: TO, name: 'Víctor Vendedor', kind: 'reactivated' })
    expect(status).toBe('sent')
    const call = resendCalls[0]!
    expect(call.body.subject).toBe(TEXTS.reactivated.headline)
    expect(variablesOf(call)).toEqual({
      NAME: 'Víctor Vendedor',
      HEADLINE: TEXTS.reactivated.headline,
      MESSAGE: TEXTS.reactivated.message,
      NOTE: TEXTS.reactivated.note,
    })
  })

  it('usa POST a la URL de Resend con Bearer, from, to y template { id, variables }, sin html ni text', async () => {
    await sendSellerStatusEmail({ to: TO, name: 'Víctor Vendedor', kind: 'deactivated' })
    const call = resendCalls[0]!
    expect(call.url).toBe(RESEND_URL)
    expect(call.init.method).toBe('POST')
    const headers = new Headers(call.init.headers)
    expect(headers.get('authorization')).toBe(`Bearer ${API_KEY}`)
    expect(headers.get('content-type')).toContain('application/json')
    expect(call.body.from).toBe(FROM)
    expect(call.body.to).toBe(TO)
    expect(call.body.template).toEqual({ id: TEMPLATE_ID, variables: expect.any(Object) })
    expect(call.body).not.toHaveProperty('html')
    expect(call.body).not.toHaveProperty('text')
  })

  it('el id de la plantilla sale de RESEND_TEMPLATE_SELLER_STATUS, no del código', async () => {
    setEmailEnv({ RESEND_TEMPLATE_SELLER_STATUS: 'otra-plantilla-999' })
    await sendSellerStatusEmail({ to: TO, name: 'Ana', kind: 'reactivated' })
    expect((resendCalls[0]!.body.template as { id: string }).id).toBe('otra-plantilla-999')
  })

  it('lleva un límite de espera (AbortSignal) para no colgar la ruta', async () => {
    await sendSellerStatusEmail({ to: TO, name: 'Ana', kind: 'deactivated' })
    expect(resendCalls[0]!.init.signal).toBeInstanceOf(AbortSignal)
  })

  it('escapa para HTML el nombre en NAME, una sola vez', async () => {
    await sendSellerStatusEmail({ to: TO, name: `Ana <b>&</b> "Co" O'Neil`, kind: 'deactivated' })
    const name = variablesOf(resendCalls[0]!).NAME
    expect(name).toContain('&lt;b&gt;&amp;&lt;/b&gt;')
    expect(name).toContain('&quot;Co&quot;')
    expect(name).toMatch(/O&(#39|#x27|apos);Neil/)
    expect(name).not.toMatch(/[<>"']/)
    expect(name).not.toContain('&amp;amp;')
  })

  it('ningún texto lleva enlaces', async () => {
    for (const kind of ['deactivated', 'reactivated'] as const) {
      resendCalls = []
      await sendSellerStatusEmail({ to: TO, name: 'Ana', kind })
      expect(JSON.stringify(resendCalls[0]!.body)).not.toMatch(/https?:\/\/|www\./i)
    }
  })
})

describe('sendSellerStatusEmail: resultado', () => {
  it.each(ENV_KEYS)('sin %s da «skipped» y no llama a fetch', async (key) => {
    setEmailEnv({ [key]: undefined })
    expect(await sendSellerStatusEmail({ to: TO, name: 'Ana', kind: 'deactivated' })).toBe('skipped')
    expect(resendCalls).toHaveLength(0)
  })

  it('sin correo del vendedor da «skipped» y no llama a fetch', async () => {
    expect(await sendSellerStatusEmail({ to: null, name: 'Ana', kind: 'deactivated' })).toBe('skipped')
    expect(resendCalls).toHaveLength(0)
  })

  it('una respuesta 2xx es «sent»', async () => {
    resendReply = async () => new Response('{"id":"abc"}', { status: 202 })
    expect(await sendSellerStatusEmail({ to: TO, name: 'Ana', kind: 'deactivated' })).toBe('sent')
  })

  it.each([422, 429, 500, 503])('una respuesta %i es «failed» sin lanzar', async (status) => {
    resendReply = async () => new Response('{"message":"error"}', { status })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await sendSellerStatusEmail({ to: TO, name: 'Ana', kind: 'deactivated' })).toBe('failed')
  })

  it('un fetch que lanza (sin red) es «failed» sin lanzar', async () => {
    resendReply = async () => {
      throw new TypeError('fetch failed')
    }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await sendSellerStatusEmail({ to: TO, name: 'Ana', kind: 'reactivated' })).toBe('failed')
  })

  it('un fetch que no contesta en 5 s es «failed»', { timeout: 15_000 }, async () => {
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      if (urlOf(input) !== RESEND_URL) return realFetch(input, init)
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new Error('abortado')))
      })
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const started = Date.now()
    expect(await sendSellerStatusEmail({ to: TO, name: 'Ana', kind: 'deactivated' })).toBe('failed')
    expect(Date.now() - started).toBeGreaterThanOrEqual(4500)
    expect(Date.now() - started).toBeLessThan(9000)
  })

  it('el log de un fallo no incluye el correo ni el texto del mensaje', async () => {
    resendReply = async () => new Response('{"message":"error"}', { status: 500 })
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await sendSellerStatusEmail({ to: TO, name: 'Víctor Vendedor', kind: 'deactivated' })
    expect(log).toHaveBeenCalled()
    const logged = JSON.stringify(log.mock.calls.map((args) => args.map((arg) => (arg instanceof Error ? arg.message : arg))))
    expect(logged).not.toContain(TO)
    expect(logged).not.toContain(TEXTS.deactivated.message)
    expect(logged).not.toContain(TEXTS.deactivated.note)
  })
})

// Productos de prueba con prefijo propio, para limpiarlos sin tocar el catálogo.
const PREFIX = 'test-status-mail-'
const request = (method: string, token?: string) =>
  new Request('http://api.test/api/sellers', {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const json = async (res: Response) => (await res.json()) as Record<string, unknown>
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

describe.skipIf(!hasServiceKey)('Aviso por correo al cambiar el estado (spec M13-hu44, con cuentas reales)', () => {
  let admin: TestUser
  let product: number

  const newSeller = (label: string, active = true) => createTestUser(label, { role: 'vendedor', active })
  const isActive = async (id: string) =>
    (await db.select({ active: profiles.active }).from(profiles).where(eq(profiles.id, id)))[0]?.active
  const deactivate = (id: string, token = admin.token) => deactivateRoute(request('POST', token), ctx(id))
  const reactivate = (id: string, token = admin.token) => reactivateRoute(request('POST', token), ctx(id))
  const deliver = (holder: string, qty: number) =>
    withTransaction((tx) =>
      insertMovements(tx, [
        { productId: product, type: 'delivery', qty: -qty, holderProfileId: null, createdBy: admin.id },
        { productId: product, type: 'delivery', qty, holderProfileId: holder, createdBy: admin.id },
      ] satisfies NewStockMovement[]),
    )

  beforeAll(async () => {
    await cleanupStock()
    await cleanupTestData()
    admin = await createTestUser('hu44-admin', { role: 'admin' })
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

  it('desactivar manda un solo correo al correo de la cuenta y responde emailStatus «sent»', async () => {
    const target = await newSeller('hu44-desactivar')
    const res = await deactivate(target.id)
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.active).toBe(false)
    expect(body.emailStatus).toBe('sent')
    expect(resendCalls).toHaveLength(1)
    expect(resendCalls[0]!.body.to).toBe(target.email)
    expect(resendCalls[0]!.body.subject).toBe(TEXTS.deactivated.headline)
  })

  it('reactivar manda un solo correo de reactivado y responde emailStatus «sent»', async () => {
    const target = await newSeller('hu44-reactivar', false)
    const res = await reactivate(target.id)
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.active).toBe(true)
    expect(body.emailStatus).toBe('sent')
    expect(resendCalls).toHaveLength(1)
    expect(resendCalls[0]!.body.to).toBe(target.email)
    expect(resendCalls[0]!.body.subject).toBe(TEXTS.reactivated.headline)
  })

  it('repetir la acción responde 200 con emailStatus null y no llama a fetch', async () => {
    const inactive = await newSeller('hu44-idem-inactivo', false)
    const again = await deactivate(inactive.id)
    expect(again.status).toBe(200)
    expect((await json(again)).emailStatus).toBeNull()

    const active = await newSeller('hu44-idem-activo')
    const same = await reactivate(active.id)
    expect(same.status).toBe(200)
    expect((await json(same)).emailStatus).toBeNull()
    expect(resendCalls).toHaveLength(0)
  })

  it('con piezas a su cargo da 409, sigue activo y no manda correo', async () => {
    const target = await newSeller('hu44-con-piezas')
    await deliver(target.id, 2)
    const res = await deactivate(target.id)
    expect(res.status).toBe(409)
    expect(await isActive(target.id)).toBe(true)
    expect(resendCalls).toHaveLength(0)
  })

  it('con un id inexistente da 404 y no manda correo', async () => {
    expect((await deactivate(UNKNOWN_ID)).status).toBe(404)
    expect((await reactivate(UNKNOWN_ID)).status).toBe(404)
    expect(resendCalls).toHaveLength(0)
  })

  it('eliminar no manda correo', async () => {
    const target = await newSeller('hu44-eliminar')
    const res = await deleteRoute(request('DELETE', admin.token), ctx(target.id))
    expect(res.status).toBe(204)
    expect(resendCalls).toHaveLength(0)
  })

  it('sin las variables de Resend el estado cambia y responde emailStatus «skipped»', async () => {
    setEmailEnv({ RESEND_API_KEY: undefined })
    const target = await newSeller('hu44-sin-clave')
    const res = await deactivate(target.id)
    expect(res.status).toBe(200)
    expect((await json(res)).emailStatus).toBe('skipped')
    expect(await isActive(target.id)).toBe(false)
    expect(resendCalls).toHaveLength(0)
  })

  it('con Resend fallando el estado queda cambiado y responde 200 con emailStatus «failed»', async () => {
    resendReply = async () => new Response('{"message":"error"}', { status: 500 })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const target = await newSeller('hu44-resend-falla')
    const res = await deactivate(target.id)
    expect(res.status).toBe(200)
    expect((await json(res)).emailStatus).toBe('failed')
    expect(await isActive(target.id)).toBe(false)

    const back = await reactivate(target.id)
    expect(back.status).toBe(200)
    expect((await json(back)).emailStatus).toBe('failed')
    expect(await isActive(target.id)).toBe(true)
  })

  it('un fallo de Resend por red tampoco revierte el cambio', async () => {
    resendReply = async () => {
      throw new TypeError('fetch failed')
    }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const target = await newSeller('hu44-sin-red')
    const res = await deactivate(target.id)
    expect(res.status).toBe(200)
    expect((await json(res)).emailStatus).toBe('failed')
    expect(await isActive(target.id)).toBe(false)
  })

  it('el correo sale después de confirmar el cambio: al llamar a Resend el vendedor ya está desactivado', async () => {
    const target = await newSeller('hu44-despues-de-confirmar')
    let activeAtSend: boolean | undefined
    resendReply = async () => {
      activeAtSend = await isActive(target.id)
      return new Response('{"id":"x"}', { status: 200 })
    }
    await deactivate(target.id)
    expect(activeAtSend).toBe(false)
  })

  it('las rutas dan 401 sin sesión y 403 a un vendedor', async () => {
    const target = await newSeller('hu44-permisos')
    expect((await deactivate(target.id, '')).status).toBe(401)
    expect((await reactivate(target.id, '')).status).toBe(401)
    expect((await deactivate(target.id, target.token)).status).toBe(403)
    expect((await reactivate(target.id, target.token)).status).toBe(403)
    expect(resendCalls).toHaveLength(0)
    expect(target.email.startsWith(TEST_PREFIX)).toBe(true)
  })
})
