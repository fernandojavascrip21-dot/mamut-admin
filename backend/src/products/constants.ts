// Bucket público de Supabase Storage donde se guardan las fotos de producto, y su tamaño máximo.
export const BUCKET = 'product-photos'
export const MAX_BYTES = 5 * 1024 * 1024

export const DUPLICATE_NAME = 'Ya existe un producto con ese nombre'
export const PRICE_BELOW_COST = 'El precio no puede ser menor que el costo'
