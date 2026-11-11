import type { ConfirmOptions } from '@core/confirm/confirm.models';

// Textos de la página «Lista de resurtir» (spec M9-hu31 §2 y §5).
export const RESTOCK_PAGE_TEXTS = {
  title: 'Lista de resurtir',
  newOrder: 'Pedido nuevo',
  draftSince: 'Borrador del',
  savedAt: 'Guardado',
  loadFailed: 'No pudimos cargar la lista de resurtir',
  retry: 'Reintentar',
  saveFailed: 'No pudimos guardar el pedido. Inténtalo de nuevo.',
  discardFailed: 'No pudimos descartar el borrador. Inténtalo de nuevo.',
  saved: 'Pedido guardado',
  closed: 'Pedido cerrado',
  discarded: 'Borrador descartado',
  closeTitle: 'Cerrar pedido',
  close: 'Cerrar pedido',
  cancel: 'Cancelar',
  productSingular: 'producto',
  productPlural: 'productos',
  loadingLabel: 'Cargando la lista de resurtir',
  // Pedidos anteriores y usar como base (spec M9-hu32 §2 y §5).
  history: 'Pedidos anteriores',
  basedOn: 'Pedido nuevo · basado en el pedido del',
  baseMissing: 'No encontramos ese pedido',
  skippedOne: '1 producto del pedido base ya no se puede pedir y no se agregó.',
  skippedMany: 'productos del pedido base ya no se pueden pedir y no se agregaron.',
  exportHelp: 'Guarda el pedido para exportarlo',
} as const;

// Confirmación de reemplazar los renglones del borrador con los de un pedido base (spec M9-hu32 §2).
export const REPLACE_DRAFT_CONFIRMATION: ConfirmOptions = {
  title: 'Usar como base',
  message: '¿Reemplazar los productos de tu borrador con los de este pedido? Se guardan cuando pulses «Guardar pedido».',
  confirmLabel: 'Reemplazar',
  cancelLabel: 'Cancelar',
  tone: 'default',
};

// Las fechas del pedido se muestran en la hora de la bodega, no en la del equipo.
export const RESTOCK_TIME_ZONE = 'America/Mexico_City';

// Tres renglones de esqueleto mientras carga la lista.
export const RESTOCK_SKELETON_ROWS = [0, 1, 2] as const;

// Confirmación al salir con cambios sin guardar (spec M9-hu31 §2).
export const UNSAVED_LEAVE_CONFIRMATION: ConfirmOptions = {
  title: 'Cambios sin guardar',
  message: '¿Salir sin guardar? Se pierden los cambios del pedido.',
  confirmLabel: 'Salir',
  cancelLabel: 'Seguir editando',
  tone: 'default',
};

// Confirmación de descartar el borrador guardado: la acción borra lo que ya se guardó.
export const DISCARD_CONFIRMATION: ConfirmOptions = {
  title: 'Descartar borrador',
  message: '¿Descartar el borrador? Se borra lo que guardaste.',
  confirmLabel: 'Descartar',
  cancelLabel: 'Cancelar',
  tone: 'danger',
};
