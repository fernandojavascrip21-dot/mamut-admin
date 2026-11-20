export const SELLER_PASSWORD_TITLE = 'Cambiar contraseña';
export const SELLER_PASSWORD_LOADING = 'Cargando vendedor…';
export const SELLER_PASSWORD_LOAD_ERROR = 'No pudimos cargar al vendedor';
export const SELLER_PASSWORD_NOT_FOUND = 'Este vendedor ya no existe';
export const SELLER_PASSWORD_INACTIVE = 'Está desactivado. Reactívalo para cambiarle la contraseña.';
export const SELLER_PASSWORD_OFFLINE_TITLE = 'No se pudo cambiar la contraseña';
export const SELLER_PASSWORD_CONNECTION_HINT = 'Revisa tu conexión e inténtalo de nuevo.';
// Un 422 sin texto del backend.
export const SELLER_PASSWORD_INVALID_FALLBACK = 'Usa al menos 8 caracteres';
export const SELLER_PASSWORD_EMAIL_WARNING = 'Se cambió la contraseña, pero no se pudo avisarle por correo';

export const sellerPasswordChangedNotice = (name: string): string =>
  `Se cambió la contraseña de ${name}. Compártesela en persona.`;
