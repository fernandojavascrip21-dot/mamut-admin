import { uploadProductPhoto } from '@products'
import { requireRole } from '@auth'
import { validation } from '@lib/errors'
import { handle } from '@lib/handler'

export const POST = handle(async (request) => {
  await requireRole(request, 'admin')

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || typeof file === 'string') throw validation('Falta el archivo de la foto')

  const url = await uploadProductPhoto(file)
  return Response.json({ url }, { status: 201 })
})
