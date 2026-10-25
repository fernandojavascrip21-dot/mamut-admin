import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POST as uploadPhotoRoute } from '../app/api/products/photo/route'
import { supabaseAdmin } from '../src/lib/supabase'
import { cleanupTestData, createTestUser, hasServiceKey, type TestUser } from './helpers/users'

const BUCKET = 'product-photos'
const uploadedPaths: string[] = []

const req = (token?: string, form?: FormData) =>
  new Request('http://api.test/api/products/photo', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: form,
  })

function imageFormData(name = 'foto.png', type = 'image/png', bytes = 'fake png bytes') {
  const form = new FormData()
  form.set('file', new File([bytes], name, { type }))
  return form
}

describe.skipIf(!hasServiceKey)('subida de foto de producto (con cuentas reales)', () => {
  let admin: TestUser
  let vendedor: TestUser

  beforeAll(async () => {
    await cleanupTestData()
    admin = await createTestUser('photo-admin', { role: 'admin' })
    vendedor = await createTestUser('photo-vendedor', { role: 'vendedor' })
  }, 60_000)

  afterAll(async () => {
    await cleanupTestData()
    if (uploadedPaths.length > 0) {
      await supabaseAdmin().storage.from(BUCKET).remove(uploadedPaths)
    }
  }, 60_000)

  it('sin token da 401 y con token de vendedor da 403', async () => {
    expect((await uploadPhotoRoute(req(undefined, imageFormData()), undefined)).status).toBe(401)
    expect((await uploadPhotoRoute(req(vendedor.token, imageFormData()), undefined)).status).toBe(403)
  })

  it('el admin sube una foto y recibe una URL pública del bucket', async () => {
    const res = await uploadPhotoRoute(req(admin.token, imageFormData('test-prod-photo.png')), undefined)
    expect(res.status).toBe(201)
    const body = (await res.json()) as { url: string }
    expect(body.url).toContain(BUCKET)
    expect(body.url).toContain('test-prod-photo.png')
    uploadedPaths.push(new URL(body.url).pathname.split(`/${BUCKET}/`)[1]!)
  })

  it('rechaza (422) si no se manda archivo', async () => {
    const res = await uploadPhotoRoute(req(admin.token, new FormData()), undefined)
    expect(res.status).toBe(422)
  })

  it('rechaza (422) un archivo que no es imagen', async () => {
    const res = await uploadPhotoRoute(
      req(admin.token, imageFormData('nota.txt', 'text/plain', 'no es una imagen')),
      undefined,
    )
    expect(res.status).toBe(422)
  })
})
