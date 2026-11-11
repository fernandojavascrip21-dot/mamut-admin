// Máximo de un integer de Postgres: más piezas que eso no caben en restock_order_lines.qty.
export const MAX_QTY = 2_147_483_647

// Renglones por pedido (de catálogo y escritos juntos): un pedido más largo no es una lista de compra razonable.
export const MAX_LINES = 200

// Caracteres de la nota, ya recortada.
export const MAX_NOTE_LENGTH = 500

// Caracteres del nombre de un renglón escrito a mano, ya recortado.
export const MAX_CUSTOM_NAME_LENGTH = 120

// Formato de to_char para el total estimado: dos decimales siempre, con «0.00» si no hay renglones.
export const ESTIMATE_FORMAT = 'FM99999999999999999990.00'

// Pedidos que devuelve la lista, los más recientes primero.
export const LIST_LIMIT = 50

// 409: el pedido ya se cerró y no admite cambios.
export const ORDER_CLOSED = 'Este pedido ya está cerrado.'

// 409: el requestId ya se usó con una nota o renglones distintos.
export const ORDER_MISMATCH = 'Este pedido ya se registró con otros datos.'

// 422: un pedido sin productos no se cierra.
export const EMPTY_ORDER = 'No se puede cerrar un pedido sin productos'

// 422: solo se piden productos activos que no son bolsita.
export const PRODUCT_NOT_ORDERABLE = 'Solo se piden productos activos que no son bolsita'

// 422: un producto solo aparece una vez por pedido (lo garantiza la base, aquí se avisa antes).
export const DUPLICATE_PRODUCT = 'Un producto aparece dos veces en el pedido'

// 422: un nombre escrito a mano solo aparece una vez por pedido, sin importar mayúsculas.
export const DUPLICATE_CUSTOM = 'Un producto escrito aparece dos veces en el pedido'

// 422: un renglón lleva productId (de catálogo) o name (escrito a mano), no los dos ni ninguno.
export const INVALID_LINE_KIND = 'Cada renglón debe llevar productId o name, no los dos ni ninguno'

// 422: el nombre escrito a mano, ya recortado, debe tener de 1 a MAX_CUSTOM_NAME_LENGTH caracteres.
export const INVALID_CUSTOM_NAME = `El nombre de un producto escrito debe tener de 1 a ${MAX_CUSTOM_NAME_LENGTH} caracteres`

// 422: costo del renglón con más de 4 decimales, negativo, fuera de rango o que no es un monto.
export const INVALID_UNIT_COST = 'El costo debe tener hasta 4 decimales y estar entre 0 y 999999.9999'

export const TOO_MANY_LINES = `Un pedido puede tener como máximo ${MAX_LINES} productos`
export const INVALID_QTY = `La cantidad de cada producto debe ser un entero de 1 a ${MAX_QTY}`
export const NOTE_TOO_LONG = `La nota puede tener como máximo ${MAX_NOTE_LENGTH} caracteres`
export const INVALID_REQUEST_ID = 'El requestId debe ser un UUID'
export const INVALID_STATUS = 'El estado debe ser draft o closed'
