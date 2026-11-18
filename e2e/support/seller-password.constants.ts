import { E2E_DATA_PREFIX } from './e2e.constants';

// Constantes de e2e/M13-hu45-contrasena-temporal-vendedor.spec.ts (HU-45).
export const BACKEND_URL = 'http://localhost:3000';

export const SELLERS_PATH = '/admin/vendedores';
export const SELLER_OLD_PASSWORD = 'Vendedor-123456!';
export const SELLER_NEW_PASSWORD = 'Temporal-654321!';
export const SELLER_PHONE = '55 1234 5678';

// Textos que ve el administrador (en local no hay clave de Resend: el correo sale «skipped»).
export const CHANGE_PASSWORD_LABEL = 'Cambiar contraseña';
export const PASSWORD_MAIL_WARNING = 'Se cambió la contraseña, pero no se pudo avisarle por correo';
export const PASSWORD_REQUIRED_ERROR = 'Escribe la contraseña temporal';
export const PASSWORD_MISMATCH_ERROR = 'Las contraseñas no coinciden';

export function e2ePasswordSellerName(tag: string): string {
  return `${E2E_DATA_PREFIX}clave-${tag}-${Date.now()}`;
}

export function e2ePasswordSellerEmail(tag: string): string {
  return `${E2E_DATA_PREFIX}clave-${tag}-${Date.now()}@mammut.local`;
}
