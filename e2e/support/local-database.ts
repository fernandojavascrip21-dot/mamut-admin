import { existsSync, readFileSync } from 'node:fs';
import { BACKEND_ENV_FILE, LOCAL_ENV_KEYS, LOCAL_HOSTS } from './e2e.constants';

// Lee las variables activas (no comentadas) de un archivo .env: `CLAVE=valor` por línea.
function activeEnv(path: string): Map<string, string> {
  const env = new Map<string, string>();
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq > 0) env.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  }
  return env;
}

function hostOf(value: string): string | null {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

// Las pruebas e2e crean y cambian datos a través del backend real. backend/.env suele quedar en
// PRODUCCIÓN tras un db:pull, así que antes de levantar nada se exige que su bloque activo apunte a
// Supabase local; si no, se detiene sin arrancar servidores. Nunca imprime los valores (llevan llaves).
export function assertLocalDatabase(): void {
  if (!existsSync(BACKEND_ENV_FILE)) {
    throw new Error(`No existe ${BACKEND_ENV_FILE}: copia backend/.env.example y activa el bloque LOCAL.`);
  }
  const env = activeEnv(BACKEND_ENV_FILE);
  for (const key of LOCAL_ENV_KEYS) {
    const value = env.get(key);
    const host = value ? hostOf(value) : null;
    if (!host || !LOCAL_HOSTS.includes(host)) {
      throw new Error(
        `${BACKEND_ENV_FILE}: ${key} no apunta a la base local (${LOCAL_HOSTS.join(' o ')}). ` +
          'Activa el bloque LOCAL antes de correr las pruebas e2e; nunca corren contra producción.',
      );
    }
  }
}
