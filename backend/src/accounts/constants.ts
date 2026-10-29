// Reglas de cualquier cuenta con login (createAccount).
export const MIN_PASSWORD = 8
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const DUPLICATE_CLIENT_NAME = 'Ya existe un cliente con ese nombre'

// Lo que se quita al escribir un teléfono y el formato guardado: 10 dígitos (spec T-10).
// Mismo contrato que src/app/shared/constants/phone.constants.ts del frontend.
export const PHONE_SEPARATORS = /[\s\-()]/g
export const TEN_DIGITS = /^[0-9]{10}$/
