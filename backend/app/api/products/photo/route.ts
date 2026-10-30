import { uploadProductPhoto } from '../../../../src/products'
import { requireRole } from '../../../../src/auth'
import { validation } from '../../../../src/lib/errors'
import { handle } from '../../../../src/lib/handler'

export const POST = handle(async (request) => {
  await requireRole(request, 'admin')

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || typeof file === 'string') throw validation('Falta el archivo de la foto')

  const url = await uploadProductPhoto(file)
  return Response.json({ url }, { status: 201 })
})
