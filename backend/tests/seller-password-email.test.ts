import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as loginRoute } from '@api/auth/login/route'
import { PUT as passwordRoute } from '@api/sellers/[id]/password/route'
import { db } from '@db/client'
import { profiles } from '@db/schema'
import * as notifications from '@notifications'
import { sellerPasswordEmail } from '@notifications'
import { cleanupTestData, createTestUser, hasServiceKey, TEST_PASSWORD, type TestUser } from './helpers/users'

// Aviso por correo al cambiar la contraseña de un vendedor (spec M13-hu45). `fetch` se reemplaza:
// nunca sale un correo real. Lo que no es de Resend (Supabase Auth) pasa al `fetch` verdadero.
const RESEND_URL = 'https://api.resend.com/emails'
const TEMPLATE_ID = 'plantilla-contrasena-de-prueba'
const API_KEY = 're_clave_de_prueba'
const FROM = 'Mammut <avisos@ejemplo.test>'
const ENV_KEYS = ['RESEND_API_KEY', 'RESEND_FROM', 'RESEND_TEMPLATE_SELLER_PASSWORD'] as const
const TO = 'victor.vendedor@ejemplo.test'
const NEW_PASSWORD = 'Nueva-Clave-987!'
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000abcd'

const TEXTS = {
  headline: 'Tu contraseña de Mammut fue cambiada',
  message: 'Tu administrador te asignó una contraseña temporal. Pídesela a tu administrador para entrar a la app.',
  note: 'Por seguridad, no incluimos tu contraseña en este correo.',
} as const

interface ResendCall {
  url: string
  init: RequestInit
  body: Record<string, unknown>
}

const realFetch = globalThis.fetch
let resendCalls: ResendCall[] = []
let resendReply: () => Promise<Response> = async () => new Response('{"id":"x"}', { status: 200 })

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
  const values = { RESEND_API_KEY: API_KEY, RESEND_FROM: FROM, RESEND_TEMPLATE_SELLER_PASSWORD: TEMPLATE_ID, ...overrides }
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
const send = (name = 'Víctor Vendedor', to: string | null = TO) => notifications.sendSellerPasswordEmail({ to, name })

describe('sellerPasswordEmail: el texto', () => {
  it('devuelve el asunto y las cuatro variables de la tabla', () => {
    expect(sellerPasswordEmail('Víctor Vendedor')).toEqual({
      subject: TEXTS.headline,
      variables: { NAME: 'Víctor Vendedor', HEADLINE: TEXTS.headline, MESSAGE: TEXTS.message, NOTE: TEXTS.note },
    })
  })

  it('escapa para HTML el nombre en NAME, una sola vez', () => {
    const name = sellerPasswordEmail(`Ana <script>&</script> "Co" O'Neil`).variables.NAME!
    expect(name).toContain('&lt;script&gt;&amp;&lt;/script&gt;')
    expect(name).toContain('&quot;Co&quot;')
    expect(name).toMatch(/O&(#39|#x27|apos);Neil/)
    expect(name).not.toMatch(/[<>"']/)
    expect(name).not.toContain('&amp;amp;')
  })

  it('ningún texto lleva enlaces', () => {
    expect(JSON.stringify(sellerPasswordEmail('Ana'))).not.toMatch(/https?:\/\/|www\./i)
  })
})

describe('sendSellerPasswordEmail: la petición a Resend', () => {
  it('manda POST con Bearer, from, to y template { id, variables } sin html ni text', async () => {
    expect(await send()).toBe('sent')
    expect(resendCalls).toHaveLength(1)
    const call = resendCalls[0]!
    expect(call.url).toBe(RESEND_URL)
    expect(call.init.method).toBe('POST')
    expect(new Headers(call.init.headers).get('authorization')).toBe(`Bearer ${API_KEY}`)
    expect(call.body.from).toBe(FROM)
    expect(call.body.to).toBe(TO)
    expect(call.body.subject).toBe(TEXTS.headline)
    expect(call.body.template).toEqual({ id: TEMPLATE_ID, variables: expect.any(Object) })
    expect(call.body).not.toHaveProperty('html')
    expect(call.body).not.toHaveProperty('text')
    expect(variablesOf(call)).toEqual({
      NAME: 'Víctor Vendedor',
      HEADLINE: TEXTS.headline,
      MESSAGE: TEXTS.message,
      NOTE: TEXTS.note,
    })
  })

  it('el id de la plantilla sale de RESEND_TEMPLATE_SELLER_PASSWORD, no del código', async () => {
    setEmailEnv({ RESEND_TEMPLATE_SELLER_PASSWORD: 'otra-plantilla-999' })
    await send('Ana')
    expect((resendCalls[0]!.body.template as { id: string }).id).toBe('otra-plantilla-999')
  })
})

describe('sendSellerPasswordEmail: resultado', () => {
  it.each(ENV_KEYS)('sin %s da «skipped» y no llama a fetch', async (key) => {
    setEmailEnv({ [key]: undefined })
    expect(await send()).toBe('skipped')
    expect(resendCalls).toHaveLength(0)
  })

  it('sin correo del vendedor da «skipped» y no llama a fetch', async () => {
    expect(await send('Ana', null)).toBe('skipped')
    expect(resendCalls).toHaveLength(0)
  })

  it('una respuesta 2xx es «sent»', async () => {
    resendReply = async () => new Response('{"id":"abc"}', { status: 202 })
    expect(await send()).toBe('sent')
  })

  it.each([422, 429, 500, 503])('una respuesta %i es «failed» sin lanzar', async (status) => {
    resendReply = async () => new Response('{"message":"error"}', { status })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await send()).toBe('failed')
  })

  it('un fetch que lanza (sin red) es «failed» sin lanzar', async () => {
    resendReply = async () => {
      throw new TypeError('fetch failed')
    }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await send()).toBe('failed')
  })

  it('el log de un fallo no incluye el correo ni el texto del mensaje', async () => {
    resendReply = async () => new Response('{"message":"error"}', { status: 500 })
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await send()
    expect(log).toHaveBeenCalled()
    const logged = JSON.stringify(log.mock.calls.map((args) => args.map((arg) => (arg instanceof Error ? arg.message : arg))))
    expect(logged).not.toContain(TO)
    expect(logged).not.toContain(TEXTS.message)
    expect(logged).not.toContain(TEXTS.note)
  })
})

const request = (method: string, token?: string, body?: unknown) =>
  new Request('http://api.test/api/sellers', {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const json = async (res: Response) => (await res.json()) as Record<string, unknown>
const tryLogin = (email: string, password: string) =>
  loginRoute(
    new Request('http://api.test/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
    undefined,
  )

describe.skipIf(!hasServiceKey)('PUT /api/sellers/[id]/password con aviso por correo (spec M13-hu45, cuentas reales)', () => {
  let admin: TestUser

  const newSeller = (label: string, active = true) => createTestUser(label, { role: 'vendedor', active })
  const change = (id: string, password = NEW_PASSWORD, token = admin.token) =>
    passwordRoute(request('PUT', token, { password }), ctx(id))

  beforeAll(async () => {
    await cleanupTestData()
    admin = await createTestUser('hu45-admin', { role: 'admin' })
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  it('un PUT válido responde 200 con emailStatus «sent» y manda un solo correo a la cuenta', async () => {
    const target = await newSeller('hu45-sent')
    const res = await change(target.id)
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ emailStatus: 'sent' })
    expect(resendCalls).toHaveLength(1)
    expect(resendCalls[0]!.body.to).toBe(target.email)
    expect(resendCalls[0]!.body.subject).toBe(TEXTS.headline)
  })

  it('la contraseña no aparece en la petición a Resend ni en la respuesta', async () => {
    const target = await newSeller('hu45-sin-clave-en-correo')
    const res = await change(target.id)
    expect(JSON.stringify(resendCalls[0]!.body)).not.toContain(NEW_PASSWORD)
    expect(JSON.stringify(await json(res))).not.toContain(NEW_PASSWORD)
  })

  it('el nombre del perfil viaja en NAME', async () => {
    const target = await newSeller('hu45-nombre')
    const [row] = await db.select({ fullName: profiles.fullName }).from(profiles).where(eq(profiles.id, target.id))
    await change(target.id)
    expect(variablesOf(resendCalls[0]!).NAME).toBe(row!.fullName)
  })

  it('el correo sale después de cambiar la contraseña: al llamar a Resend la nueva ya entra', async () => {
    const target = await newSeller('hu45-orden')
    let statusAtSend: number | undefined
    resendReply = async () => {
      statusAtSend = (await tryLogin(target.email, NEW_PASSWORD)).status
      return new Response('{"id":"x"}', { status: 200 })
    }
    await change(target.id)
    expect(statusAtSend).toBe(200)
  })

  it('con fetch fallando responde «failed», la contraseña nueva entra y la anterior no', async () => {
    resendReply = async () => {
      throw new TypeError('fetch failed')
    }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const target = await newSeller('hu45-failed')
    const res = await change(target.id)
    expect(res.status).toBe(200)
    expect((await json(res)).emailStatus).toBe('failed')
    expect((await tryLogin(target.email, TEST_PASSWORD)).status).toBe(401)
    expect((await tryLogin(target.email, NEW_PASSWORD)).status).toBe(200)
  })

  it('sin RESEND_TEMPLATE_SELLER_PASSWORD responde «skipped» sin llamar a fetch y la contraseña cambia', async () => {
    setEmailEnv({ RESEND_TEMPLATE_SELLER_PASSWORD: undefined })
    const target = await newSeller('hu45-skipped')
    const res = await change(target.id)
    expect(res.status).toBe(200)
    expect((await json(res)).emailStatus).toBe('skipped')
    expect(resendCalls).toHaveLength(0)
    expect((await tryLogin(target.email, NEW_PASSWORD)).status).toBe(200)
  })

  it('un vendedor desactivado también recibe el aviso', async () => {
    const target = await newSeller('hu45-inactivo', false)
    const res = await change(target.id)
    expect(res.status).toBe(200)
    expect((await json(res)).emailStatus).toBe('sent')
    expect(resendCalls).toHaveLength(1)
  })

  it('con 7 caracteres da 422 y no llama a fetch', async () => {
    const target = await newSeller('hu45-422')
    expect((await change(target.id, '1234567')).status).toBe(422)
    expect(resendCalls).toHaveLength(0)
  })

  it('con un id inexistente da 404 y no llama a fetch', async () => {
    expect((await change(UNKNOWN_ID)).status).toBe(404)
    expect(resendCalls).toHaveLength(0)
  })

  it('da 401 sin sesión y 403 a un vendedor, sin llamar a fetch', async () => {
    const target = await newSeller('hu45-permisos')
    expect((await change(target.id, NEW_PASSWORD, '')).status).toBe(401)
    expect((await change(target.id, NEW_PASSWORD, target.token)).status).toBe(403)
    expect(resendCalls).toHaveLength(0)
  })
})
