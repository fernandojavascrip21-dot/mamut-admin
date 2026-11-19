// Reglas de cualquier cuenta con login (createAccount).
export const MIN_PASSWORD = 8
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const DUPLICATE_CLIENT_NAME = 'Ya existe un cliente con ese nombre'

// Lo que se quita al escribir un teléfono y el formato guardado: 10 dígitos (spec T-10).
// Mismo contrato que src/app/shared/constants/phone.constants.ts del frontend.
export const PHONE_SEPARATORS = /[\s\-()]/g
export const TEN_DIGITS = /^[0-9]{10}$/

// Nombre del negocio del vendedor (spec M13-t42): opcional, máximo 80 caracteres.
export const MAX_BUSINESS_NAME = 80

// Valor de `?status=` que no es válido en la lista o en el detalle (spec M13-t42): 422.
export const SELLER_STATUS_INVALID = 'El parámetro status no es válido'

// Desactivar con piezas a su cargo, y eliminar con historial (spec M13-t42): 409.
export const SELLER_HAS_UNITS = 'Retírale sus piezas antes de desactivarlo'
export const ARCHIVED_EMAIL_DOMAIN = 'mammut.invalid'
export const SELLER_HISTORY_APPEARED = 'El vendedor acaba de tener movimientos: intenta de nuevo'
