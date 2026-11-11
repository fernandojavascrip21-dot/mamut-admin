// Textos de la ventana «Pedidos anteriores» (spec M9-hu32 §2 y §5).
export const RESTOCK_HISTORY_PAGE_TEXTS = {
  title: 'Pedidos anteriores',
  backToOrder: 'Volver al pedido',
  loadFailed: 'No pudimos cargar los pedidos anteriores',
  retry: 'Reintentar',
  empty: 'Todavía no hay pedidos cerrados',
  emptyHint: 'Cuando cierres un pedido aparecerá aquí.',
  loadingLabel: 'Cargando los pedidos anteriores',
} as const;

// Tres renglones de esqueleto mientras carga la lista.
export const RESTOCK_HISTORY_SKELETON_ROWS = [0, 1, 2] as const;
