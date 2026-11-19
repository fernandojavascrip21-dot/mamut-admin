import { E2E_DATA_PREFIX } from './e2e.constants';

// Constantes de e2e/M13-hu44-desactivar-reactivar-eliminar-vendedor.spec.ts (HU-44).
export const BACKEND_URL = 'http://localhost:3000';

export const SELLER_PASSWORD = 'Vendedor-123456!';
export const SELLER_BUSINESS = 'Gimnasio Fuerza Norte';
export const SELLER_PHONE = '55 1234 5678';

// Vendedor del seed con 6 piezas y entregas: no se puede desactivar ni eliminar.
export const SEED_SELLER_NAME = 'Víctor Vendedor';

export const WAREHOUSE_LABEL = 'Yo · bodega';

// Textos que ve el administrador (en local no hay clave de Resend: el correo sale «skipped»).
export const DEACTIVATE_MAIL_WARNING = 'Se desactivó, pero no se pudo avisarle por correo';
export const REACTIVATE_MAIL_WARNING = 'Se reactivó, pero no se pudo avisarle por correo';
export const HAS_UNITS_ALERT = 'Retírale sus piezas antes de desactivarlo';
export const HAS_HISTORY_ALERT = 'Tiene historial: solo se puede desactivar';

export const SELLERS_PATH = '/admin/vendedores';
export const SELLERS_INACTIVE_PATH = '/admin/vendedores?estado=desactivados';

export function e2eStatusSellerName(tag: string): string {
  return `${E2E_DATA_PREFIX}estado-${tag}-${Date.now()}`;
}

export function e2eStatusSellerEmail(tag: string): string {
  return `${E2E_DATA_PREFIX}estado-${tag}-${Date.now()}@mammut.local`;
}

// Constantes de e2e/M13-hu45-archivar-vendedor-con-historial.spec.ts (ampliación §10 de HU-45).
export const ARCHIVE_UNITS = 1;
export const ARCHIVE_NOTICE = 'Si tiene historial, solo se archiva';
