import { WHATSAPP_NUMERO } from '@/config'

const enlace = (mensaje) =>
  'https://wa.me/' + WHATSAPP_NUMERO + '?text=' + encodeURIComponent(mensaje)

export const enlaceTienda = () =>
  enlace('Hola, tengo una pregunta sobre los productos de Mammoth Suplements.')

export function enlaceProducto(producto) {
  if (Number(producto.existencia) === 0) {
    return enlace('Hola, ¿cuándo vuelve a entrar ' + producto.nombre + '?')
  }
  const datos = [producto.nombre, producto.presentacion, producto.sabor]
    .filter(Boolean)
    .join(' – ')
  return enlace('Hola, me interesa el producto: ' + datos + '. ¿Sigue disponible?')
}

export const textoBoton = (producto) =>
  Number(producto.existencia) === 0 ? 'Preguntar disponibilidad' : 'Pedir por WhatsApp'
