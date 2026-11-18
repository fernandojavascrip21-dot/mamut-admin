import type { ConfirmOptions } from '@core/confirm/confirm.models';
import { EDIT_FIELD_MESSAGES } from '../components/seller-edit-form/seller-edit-form.constants';
import type { SellerEditField } from '../components/seller-edit-form/seller-edit-form.models';

export const EDIT_SELLER_TITLE = 'Editar datos';

export const UNSAVED_SELLER_CONFIRMATION: ConfirmOptions = {
  title: '¿Salir sin guardar?',
  message: 'Perderás los cambios en los datos del vendedor.',
  confirmLabel: 'Salir',
  cancelLabel: 'Seguir editando',
  tone: 'default',
};

export const SELLER_GONE_NOTICE = 'Este vendedor ya no está disponible';

export const EDIT_SELLER_LOADING = 'Cargando vendedor…';
export const EDIT_SELLER_NOT_FOUND = 'No encontramos a este vendedor';
export const EDIT_SELLER_LOAD_ERROR = 'No pudimos cargar al vendedor';
export const EDIT_SELLER_OFFLINE_TITLE = 'No se pudo guardar';
export const CONNECTION_HINT = 'Revisa tu conexión e inténtalo de nuevo.';
export const EDIT_DUPLICATE_EMAIL = 'Ya existe un acceso con ese correo';

// Un 422 del backend trae uno de estos textos; así se pinta bajo su campo. Uno que no esté aquí
// solo sale en el aviso flotante.
export const EDIT_BACKEND_MESSAGE_FIELD: Record<string, SellerEditField> = {
  [EDIT_FIELD_MESSAGES.fullName.invalid]: 'fullName',
  [EDIT_FIELD_MESSAGES.businessName.invalid]: 'businessName',
  [EDIT_FIELD_MESSAGES.phone.invalid]: 'phone',
  [EDIT_FIELD_MESSAGES.email.invalid]: 'email',
};
