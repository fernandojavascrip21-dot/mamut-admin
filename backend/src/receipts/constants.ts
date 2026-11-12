import type { SkipReason } from './types'

// Reusados de HU-27 y HU-04 (spec M9-t41): mismo tope de piezas y mismos mensajes que la entrada a bodega y el alta.
export { MAX_QTY, PRODUCT_INACTIVE } from '@purchases'
export { PRICE_BELOW_COST } from '@products'

// Tamaños: el Excel y el PDF pesan hasta 10 MB; una imagen, hasta 5 MB (tope de la API de Claude por imagen).
export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_PDF_PAGES = 20

// Renglones leídos (válidos + saltados) por remisión.
export const MAX_LINES = 200
export const MAX_NAME_LENGTH = 200
export const MAX_FILE_NAME_LENGTH = 255

// El encabezado se busca solo en las primeras filas: una remisión real pone la tabla arriba.
export const HEADER_SCAN_ROWS = 20

// Tiempo máximo de la llamada a la API de Claude para PDF e imagen.
export const AI_TIMEOUT_MS = 60_000

// Modelo y instrucciones de la lectura de PDF e imagen (spec M9-t41 §3).
export const RECEIPT_AI_MODEL = 'claude-sonnet-5-5'
export const RECEIPT_AI_INSTRUCTIONS = [
  'Lee la tabla de productos de la remisión de proveedor adjunta.',
  'Copia los textos tal como aparecen, sin calcular ni corregir nada.',
  'Si hay columnas de Mayoreo y de Distribuidor, toma las piezas de «Cant. Distribuidor» y el costo de «Precio Distribuidor».',
  'Omite las filas de totales, subtotal, IVA, descuento y envío.',
  'Responde solo con el esquema pedido: name (texto), qty (entero o null) y unitCost (texto con el número o null).',
].join('\n')

// Sinónimos de encabezado, ya normalizados (normalizeName). La comparación es por igualdad exacta.
export const PRODUCT_HEADERS = ['producto', 'descripcion', 'nombre', 'articulo', 'concepto'] as const
export const QTY_HEADERS = ['cant distribuidor', 'cantidad', 'cant', 'piezas', 'pzas', 'unidades'] as const
export const COST_HEADERS = ['precio distribuidor', 'costo', 'costo unitario', 'precio unitario', 'p u', 'precio'] as const

// Filas de totales y de envío: se ignoran sin dejar motivo (el costo de «envio» no se usa).
export const IGNORED_ROW_NAMES = ['total', 'subtotal', 'iva', 'descuento', 'envio'] as const

// Motivos de renglón no leído y su texto para la pantalla.
export const SKIP_LABELS: Record<SkipReason, string> = {
  missing_name: 'Falta el nombre del producto',
  invalid_qty: 'Las piezas no son un número entero mayor a 0',
  invalid_cost: 'El costo no es válido',
  inactive_product: 'Producto desactivado',
}

// Mensajes de error, en español. Los 422 van en validación; los 409 y 404 los usa cada caso de uso.
export const UNSUPPORTED_FILE = 'Solo se aceptan remisiones en PDF, Excel (.xlsx) o imagen (JPG o PNG)'
export const FILE_TOO_LARGE = 'El archivo pesa más de 10 MB'
export const IMAGE_TOO_LARGE = 'La imagen pesa más de 5 MB'
export const PDF_TOO_MANY_PAGES = 'El PDF tiene más de 20 páginas'
export const NO_HEADER = 'No encontré las columnas de producto y piezas en la remisión'
export const TOO_MANY_LINES = 'La remisión tiene más de 200 renglones'
export const AI_NOT_CONFIGURED = 'La lectura de PDF e imágenes no está configurada'
export const AI_READ_FAILED = 'No se pudo leer el archivo; intenta de nuevo o sube el Excel'
export const REQUEST_MISMATCH = 'Esta remisión ya se registró con otros datos.'
export const LINE_ALREADY_RESOLVED = 'Este pendiente ya se resolvió.'
export const MISSING_UNIT_COST = 'Falta el costo de fábrica'
export const COST_ABOVE_PRICE = 'El precio de venta es menor que el costo nuevo; edita el precio primero'
export const RECEIPT_NOT_FOUND = 'No existe una remisión con ese requestId'
