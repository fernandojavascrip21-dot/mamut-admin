import type { ConfirmOptions } from '@core/confirm/confirm.models';

export const DISCARD_CONFIRMATION: ConfirmOptions = {
  title: '¿Descartar los cambios?',
  message: 'Lo que cambiaste no se va a guardar.',
  confirmLabel: 'Descartar',
  cancelLabel: 'Seguir editando',
  tone: 'danger',
};
