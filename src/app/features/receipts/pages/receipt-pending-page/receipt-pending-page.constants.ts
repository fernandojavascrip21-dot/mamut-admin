// Textos de la página «Pendientes de remisiones» (HU-42 §3). Las funciones arman los mensajes con datos.
export const RECEIPT_PENDING_PAGE_TEXTS = {
  title: 'Pendientes de remisiones',
  upload: 'Cargar remisión',
  newTab: 'Productos nuevos',
  costTab: 'Cambios de costo',
  tabsLabel: 'Tipo de pendiente',
  cancel: 'Cancelar',
  loadFailed: 'No pudimos cargar los pendientes',
  retry: 'Reintentar',
  emptyNew: 'No hay productos nuevos pendientes',
  emptyCost: 'No hay cambios de costo pendientes',
  discardTitle: 'Descartar producto',
  discardConfirm: 'Descartar',
  discardMessage: (name: string, qty: number) => `¿Descartar ${name}? Sus ${qty} piezas no entrarán a bodega.`,
  discarded: 'Producto descartado',
  discardFailed: 'No pudimos descartar el producto. Inténtalo de nuevo.',
  acceptTitle: 'Cambiar costo',
  acceptConfirm: 'Aceptar',
  acceptMessage: (name: string, cost: string) =>
    `¿Cambiar el costo de fábrica de ${name} a $${cost}? El precio de venta no cambia.`,
  accepted: 'Costo actualizado',
  acceptFailed: 'No pudimos aceptar el costo. Inténtalo de nuevo.',
  rejected: 'Costo rechazado',
  rejectFailed: 'No pudimos rechazar el costo. Inténtalo de nuevo.',
  created: (name: string, before: number, after: number) => `${name} dado de alta · Bodega ${before} → ${after}`,
  createFailed: 'No pudimos dar de alta el producto. Inténtalo de nuevo.',
  categoriesFailed: 'No pudimos cargar las categorías.',
} as const;

// Tres tarjetas de esqueleto mientras llega la lista.
export const RECEIPT_PENDING_SKELETON_ROWS = [0, 1, 2] as const;
