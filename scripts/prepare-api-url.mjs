import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Solo el host local puede usar http: en desarrollo; cualquier otro backend debe ir por https.
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

// Lee API_BASE_URL igual que la licencia: la variable de proceso gana, aunque esté vacía.
function readApiBaseUrl() {
  const fromProcess = process.env.API_BASE_URL;
  if (fromProcess !== undefined) return fromProcess;

  try {
    return parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8')).API_BASE_URL;
  } catch (error) {
    // Sin .env se sigue como si la variable faltara; cualquier otro fallo de lectura se reporta sin el original.
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw new Error('No se pudo leer el .env del frontend. Revisa sus permisos y formato.');
  }
}

// Valida que el valor sea solo el origen del backend: el navegador concatena las rutas de la API.
function normalizeOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('API_BASE_URL debe ser una URL absoluta http(s), por ejemplo https://api.ejemplo.com.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('API_BASE_URL debe ser una URL absoluta http(s), por ejemplo https://api.ejemplo.com.');
  }
  if (url.protocol === 'http:' && !LOCAL_HOSTS.includes(url.hostname)) {
    throw new Error('API_BASE_URL debe usar https:// fuera de localhost.');
  }
  // Una "/" final sola no es ruta; cualquier otra ruta, query o fragmento se rechaza.
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error('API_BASE_URL debe ser solo el origen del backend, sin ruta (por ejemplo https://api.ejemplo.com).');
  }
  return url.origin;
}

function prepareApiUrl() {
  const apiBaseUrl = readApiBaseUrl()?.trim();

  if (!apiBaseUrl) {
    throw new Error('Configura API_BASE_URL en el .env del frontend o en el entorno antes de compilar (por ejemplo http://localhost:3000).');
  }

  const origin = normalizeOrigin(apiBaseUrl);
  const targetDirectory = new URL('../src/app/core/', import.meta.url);
  mkdirSync(targetDirectory, { recursive: true });
  const source = '// Archivo generado por npm run api:prepare. No versionar.\n'
    + `export const API_BASE_URL: string = ${JSON.stringify(origin)};\n`;
  writeFileSync(new URL('api-base-url.generated.ts', targetDirectory), source, { mode: 0o600 });
}

try {
  prepareApiUrl();
} catch (error) {
  // No imprimir el error original de una dependencia: puede contener datos de configuración.
  process.stderr.write(`${error instanceof Error ? error.message : 'No se pudo preparar la URL de la API.'}\n`);
  process.exitCode = 1;
}
