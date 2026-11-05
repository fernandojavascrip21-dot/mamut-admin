// Nivel de existencia de un producto en manos de un titular (HU-18). Lo decide el backend
// (`stockLevel`); el frontend nunca repite el límite, solo pinta lo que recibe.
export type StockLevel = 'ok' | 'low' | 'out';

// Textos de las etiquetas de existencia. «Baja existencia» es la de administrador («Stock general»,
// «Productos», «Venta confirmada»); «Quedan pocas» es la del vendedor en «Mi stock».
export const STOCK_LEVEL_LABELS = {
  low: 'Baja existencia',
  out: 'Agotado',
  sellerLow: 'Quedan pocas',
} as const;
