import type { ConfirmOptions } from '@core/confirm/confirm.models';

export const LOGOUT_CONFIRMATION: ConfirmOptions = {
  title: '¿Cerrar sesión?',
  message: 'Para volver a entrar necesitarás tu usuario y contraseña. Lo que ya registraste queda guardado.',
  confirmLabel: 'Cerrar sesión',
  cancelLabel: 'Cancelar',
  tone: 'danger',
};
