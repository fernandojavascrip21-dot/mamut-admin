import type { RestockNoticeAction } from './restock-form.models';

// Textos del formulario de la lista de resurtir (spec M9-hu31 §2 y §5).
export const RESTOCK_FORM_TEXTS = {
  emptyTitle: 'Nada que resurtir',
  emptyHint: 'Todos los productos tienen piezas en bodega.',
  addProduct: 'Agregar producto',
  addProductPlaceholder: 'Elige un producto',
  addProductFilter: 'Buscar por nombre',
  suggested: 'Agregar sugeridos',
  writeProduct: 'Escribir un producto',
  customNameLabel: 'Nombre',
  customCostLabel: 'Costo unitario',
  addCustom: 'Agregar',
  cancelCustom: 'Cancelar',
  noteLabel: 'Nota del pedido',
  noteTooLong: 'La nota es demasiado larga. Recórtala hasta 500 caracteres.',
  total: 'Total estimado',
  withoutCost: 'sin costo',
  save: 'Guardar pedido',
  close: 'Cerrar pedido',
  discard: 'Descartar borrador',
  notOrderable: 'Quita los productos que ya no se pueden pedir',
  tooManyLines: 'Un pedido lleva hasta 200 productos',
  emptyClose: 'Agrega al menos un producto para cerrar el pedido',
  columnProduct: 'Producto',
  columnStock: 'En bodega',
  columnPieces: 'Piezas',
  columnCost: 'Costo unitario',
  columnRemove: 'Quitar',
} as const;

// Etiquetas del botón de acción del aviso de la página.
export const RESTOCK_NOTICE_LABELS: Record<RestockNoticeAction, string> = {
  retry: 'Reintentar',
  reload: 'Volver a cargar',
};
