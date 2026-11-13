// Textos del renglón de revisión (HU-42 §3). Los números y las reglas viven en las funciones de rules/ y
// validators/; aquí solo lo que se lee en pantalla.
export const RECEIPT_LINE_TEXTS = {
  product: 'Producto',
  productFilter: 'Buscar producto',
  newProduct: 'Producto nuevo',
  suggestedPrefix: 'Nombre sugerido:',
  pendingNew: 'Quedará en pendientes para darlo de alta',
  recognized: 'Reconocido',
  chosen: 'Elegido por ti',
  qty: 'Piezas',
  unitCost: 'Costo leído',
  unitCostHint: 'Vacío = sin costo',
  costDifferTitle: 'Costo distinto',
  costDifferPending: 'quedará en pendientes',
  qtyRequired: 'Escribe las piezas',
  qtyInteger: 'Las piezas son un número entero de 1 o más',
  qtyTooLarge: 'Son demasiadas piezas',
  costInvalid: 'El costo tiene hasta 4 decimales y no pasa de 999999.9999',
  catalogError: 'No pudimos cargar los productos',
  retry: 'Reintentar',
  remove: 'Quitar',
} as const;
