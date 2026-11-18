import { E2E_DATA_PREFIX } from './e2e.constants';

// Constantes de e2e/M13-hu43-ficha-editar-vendedor.spec.ts (HU-43).
export const BACKEND_URL = 'http://localhost:3000';

export const SELLER_PASSWORD = 'Vendedor-123456!';
export const SELLER_BUSINESS = 'Gimnasio Fuerza Norte';
export const SELLER_NEW_BUSINESS = 'Café Centro';
export const SELLER_PHONE = '55 1234 5678';
export const SELLER_NEW_PHONE = '55 9876 5432';

// Nombre y correo únicos de un vendedor de prueba; el prefijo permite reconocerlo y limpiarlo.
export function e2eSellerName(tag: string): string {
  return `${E2E_DATA_PREFIX}${tag}-${Date.now()}`;
}

export function e2eSellerEmail(tag: string): string {
  return `${E2E_DATA_PREFIX}${tag}-${Date.now()}@mammut.local`;
}
