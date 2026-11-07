// Bolsitas por fraccionado: el spec T-24 fija 2..1000.
export const MIN_PORTIONS = 2
export const MAX_PORTIONS = 1000

export const PORTIONS_OUT_OF_RANGE = `Las bolsitas van de ${MIN_PORTIONS} a ${MAX_PORTIONS}`

// Cada fraccionado abre exactamente 1 entero de la bodega.
export const WHOLE_UNITS_PER_FRACTION = 1

export const NOT_FRACTIONABLE = 'Este producto no se fracciona'
export const FRACTION_MISMATCH = 'Este fraccionado ya se registró con otros datos.'
export const PRICE_REQUIRED = 'Falta el precio de la bolsita'
export const PORTION_COST_ZERO = 'El costo por bolsita es demasiado bajo'

// Nombre del índice único de productos por nombre (lower(trim(name))).
export const PRODUCT_NAME_CONSTRAINT = 'products_name_lower_key'
// Nombre del índice único de requestId: su violación es una repetición, no un error.
export const FRACTION_REQUEST_CONSTRAINT = 'fractions_request_id_key'
