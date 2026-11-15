import logoReemplazo from '@/assets/logo-mammoth.png'

export const IMAGEN_REEMPLAZO = logoReemplazo

/**
 * Convierte un enlace de Google Drive al formato de visualización directa.
 * Acepta:
 *   https://drive.google.com/file/d/<ID>/view?usp=sharing
 *   https://drive.google.com/open?id=<ID>
 *   https://drive.google.com/uc?export=view&id=<ID>
 * Cualquier otra URL se devuelve tal cual.
 */
export function urlImagen(url) {
  if (!url) return IMAGEN_REEMPLAZO
  const limpia = String(url).trim()
  const porRuta = limpia.match(/drive\.google\.com\/file\/d\/([^/]+)/)
  const porQuery = limpia.match(/[?&]id=([^&]+)/)
  const id = (porRuta && porRuta[1]) || (porQuery && porQuery[1])
  if (id && limpia.includes('drive.google.com')) {
    return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1000'
  }
  return limpia
}

/** onerror: si la foto no carga, se muestra el logo como reemplazo. */
export function alFallarImagen(evento) {
  const img = evento.target
  if (img.dataset.reemplazada) return
  img.dataset.reemplazada = '1'
  img.src = IMAGEN_REEMPLAZO
  img.classList.add('opacity-40', 'p-6', 'object-contain')
}
