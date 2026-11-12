import { requireRole } from '@auth'
import { validation } from '@lib/errors'
import { handle } from '@lib/handler'
import { MISSING_FILE, previewReceipt } from '@receipts'

// Vista previa de una remisión (HU-42): lee el archivo y propone renglones. No escribe nada. Solo
// administrador; las reglas viven en el caso de uso.
export const POST = handle(async (request) => {
  const actor = await requireRole(request, 'admin')
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || typeof file === 'string') throw validation(MISSING_FILE)

  return Response.json(await previewReceipt(file, actor))
})
