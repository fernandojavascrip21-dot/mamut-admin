import { supabaseAdmin } from '../lib/supabase'
import { validation } from '../lib/errors'
import { BUCKET, MAX_BYTES } from './constants'

// Sube la foto al bucket público con la llave de servicio (evade RLS por diseño): la subida
// directa desde Angular con el JWT del admin se intentó primero (specs/M1-hu04-dar-de-alta-
// producto/spec.md §8) pero el servicio de Storage de Supabase rechazaba el JWT de usuario
// por una razón que no se pudo diagnosticar; el backend es quien sube el archivo.
export async function uploadProductPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw validation('La foto debe ser una imagen')
  if (file.size > MAX_BYTES) throw validation('La foto no puede pesar más de 5 MB')

  const path = `${Date.now()}-${file.name}`
  const admin = supabaseAdmin()
  const { data, error } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
  })
  if (error || !data) throw error ?? new Error('No se pudo subir la foto')

  return admin.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl
}
