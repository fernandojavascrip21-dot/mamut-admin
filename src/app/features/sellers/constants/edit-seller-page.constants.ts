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


export const EDIT_SELLER_LOADING = 'Cargando vendedor…';
export const EDIT_SELLER_NOT_FOUND = 'No encontramos a este vendedor';
export const EDIT_SELLER_LOAD_ERROR = 'No pudimos cargar al vendedor';
export const EDIT_SELLER_OFFLINE_TITLE = 'No se pudo guardar';
export const CONNECTION_HINT = 'Revisa tu conexión e inténtalo de nuevo.';
// Un 422 sin texto del backend: se pide revisar lo escrito.
export const EDIT_INVALID_FALLBACK = 'Revisa los datos del vendedor.';

// Un 422 del backend trae uno de estos textos; así se pinta bajo su campo. Uno que no esté aquí
// solo sale en el aviso flotante.
export const EDIT_BACKEND_MESSAGE_FIELD: Record<string, SellerEditField> = {
  [EDIT_FIELD_MESSAGES.fullName.invalid]: 'fullName',
  [EDIT_FIELD_MESSAGES.businessName.invalid]: 'businessName',
  [EDIT_FIELD_MESSAGES.phone.invalid]: 'phone',
  [EDIT_FIELD_MESSAGES.email.invalid]: 'email',
};

// --- Estado del vendedor (HU-44) ---
const UNSAVED_LOST_LINE = 'Los cambios sin guardar se pierden.';

// Confirmación de desactivar; con cambios sin guardar suma su línea.
export const deactivateConfirmation = (name: string, hasChanges: boolean): ConfirmOptions => ({
  title: `¿Desactivar a «${name}»?`,
  message:
    'Ya no podrá entrar a la app ni aparecerá en «Viendo» ni en «Dejar». Sus ventas y cortes se conservan, puedes reactivarlo cuando quieras y le mandaremos un aviso por correo.' +
    (hasChanges ? ` ${UNSAVED_LOST_LINE}` : ''),
  confirmLabel: 'Desactivar',
  cancelLabel: 'Cancelar',
  tone: 'default',
});

// Confirmación de eliminar (botón de peligro); con cambios sin guardar suma su línea.
export const removeConfirmation = (name: string, hasChanges: boolean): ConfirmOptions => ({
  title: `¿Eliminar a «${name}»?`,
  message:
    'Se borra su acceso para siempre. Solo se puede si nunca tuvo movimientos; si tiene historial, desactívalo.' +
    (hasChanges ? ` ${UNSAVED_LOST_LINE}` : ''),
  confirmLabel: 'Eliminar',
  cancelLabel: 'Cancelar',
  tone: 'danger',
});

export const sellerDeactivatedNotice = (name: string): string => `«${name}» desactivado`;
export const sellerRemovedNotice = (name: string): string => `«${name}» eliminado`;
export const DEACTIVATE_EMAIL_WARNING = 'Se desactivó, pero no se pudo avisarle por correo';

// Aviso cuando la acción de estado no llega al backend o da 5xx.
export const STATUS_OFFLINE_NOTICE = {
  deactivate: 'No se pudo desactivar. Revisa tu conexión e inténtalo de nuevo.',
  reactivate: 'No se pudo reactivar. Revisa tu conexión e inténtalo de nuevo.',
  remove: 'No se pudo eliminar. Revisa tu conexión e inténtalo de nuevo.',
} as const;
