// Constantes de las pruebas de punta a punta (Playwright). Las cuentas son las ficticias de
// `supabase/seed.sql` (también están en CLAUDE.md): solo existen en la base local.

export const FRONTEND_URL = 'http://localhost:4200';
export const BACKEND_HEALTH_URL = 'http://localhost:3000/api/health';

// Archivo que leen Next, Vitest y drizzle; el bloque activo decide a qué base escriben las pruebas.
export const BACKEND_ENV_FILE = 'backend/.env';
// Variables del bloque activo que tienen que apuntar a la máquina local.
export const LOCAL_ENV_KEYS = ['DATABASE_URL', 'SUPABASE_URL'] as const;
export const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];

// Prefijo de los datos que cree una prueba e2e, para reconocerlos y limpiarlos.
export const E2E_DATA_PREFIX = 'test-e2e-';

export const SEED_ACCOUNTS = {
  admin: { email: 'admin@mammut.local', password: 'Admin-123456!' },
  seller: { email: 'vendedor1@mammut.local', password: 'Vendedor-123456!' },
  inactive: { email: 'inactivo@mammut.local', password: 'Vendedor-123456!' },
} as const;

// Home de cada rol después de iniciar sesión.
export const ADMIN_HOME_PATH = '/admin/stock';
export const SELLER_HOME_PATH = '/vendedor/mi-stock';
