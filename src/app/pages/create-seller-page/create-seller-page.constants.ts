import type { SellerField } from './create-seller-page.models';

// Mismo mínimo que valida el backend (`validatePassword` en backend/src/accounts/accounts.ts).
export const MIN_PASSWORD = 8;

// Mensaje de cada campo cuando está vacío (`required`) o tiene un formato que no sirve (`invalid`).
export const FIELD_MESSAGES: Record<SellerField, { required: string; invalid: string }> = {
  fullName: { required: 'Escribe el nombre del vendedor', invalid: 'Escribe el nombre del vendedor' },
  phone: { required: 'Escribe el teléfono del vendedor', invalid: 'El teléfono debe tener 10 dígitos' },
  email: { required: 'Escribe el correo para entrar', invalid: 'El correo no es válido' },
  password: {
    required: 'Escribe una contraseña temporal',
    invalid: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`,
  },
};

export const DUPLICATE_EMAIL = 'Ya existe un acceso con ese correo';
export const OFFLINE_MESSAGE = 'No se pudo guardar. Revisa tu conexión.';

// Un 422 del backend trae uno de estos textos (los mismos de FIELD_MESSAGES); así se pinta bajo
// su campo. Uno que no esté aquí solo sale en el aviso flotante.
export const BACKEND_MESSAGE_FIELD: Record<string, SellerField> = {
  [FIELD_MESSAGES.phone.invalid]: 'phone',
  [FIELD_MESSAGES.email.invalid]: 'email',
  [FIELD_MESSAGES.password.invalid]: 'password',
};
