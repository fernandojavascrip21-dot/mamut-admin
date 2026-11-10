import type { ConfirmOptions } from '@core/confirm/confirm.models';

export const RESTOCK_PAGE_TEXTS = {} as const;

// Confirmación al salir con cambios sin guardar (spec M9-hu31 §2).
export const UNSAVED_LEAVE_CONFIRMATION: ConfirmOptions = {
  title: 'Cambios sin guardar',
  message: '¿Salir sin guardar? Se pierden los cambios del pedido.',
  confirmLabel: 'Salir',
  cancelLabel: 'Seguir editando',
  tone: 'default',
};
