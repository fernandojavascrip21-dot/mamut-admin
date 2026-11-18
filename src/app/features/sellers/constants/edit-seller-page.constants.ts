import type { ConfirmOptions } from '@core/confirm/confirm.models';

export const EDIT_SELLER_TITLE = 'Editar datos';

export const UNSAVED_SELLER_CONFIRMATION: ConfirmOptions = {
  title: '¿Salir sin guardar?',
  message: 'Perderás los cambios en los datos del vendedor.',
  confirmLabel: 'Salir',
  cancelLabel: 'Seguir editando',
  tone: 'default',
};

export const SELLER_GONE_NOTICE = 'Este vendedor ya no está disponible';
