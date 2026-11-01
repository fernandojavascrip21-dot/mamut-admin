import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Prepara solo la clave pública que necesita PrimeNG; las demás variables locales no llegan al bundle.
function prepareLicense() {
  let licenseKey = process.env.PRIMENG_LICENSE_KEY;

  // Una variable de CI prevalece incluso si está vacía, para detectar una configuración incompleta.
  if (licenseKey === undefined) {
    try {
      licenseKey = parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8')).PRIMENG_LICENSE_KEY;
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
        throw new Error('No se pudo leer el .env del frontend. Revisa sus permisos y formato.');
      }
    }
  }

  if (!licenseKey?.trim()) {
    throw new Error('Configura PRIMENG_LICENSE_KEY en el .env del frontend o en el entorno antes de compilar.');
  }

  const targetDirectory = new URL('../src/app/core/ui/constants/', import.meta.url);
  mkdirSync(targetDirectory, { recursive: true });
  const source = '// Archivo generado por npm run ui:prepare. No versionar.\n'
    + `export const PRIMENG_LICENSE_KEY: string = ${JSON.stringify(licenseKey.trim())};\n`;
  writeFileSync(new URL('primeng-license.generated.ts', targetDirectory), source, { mode: 0o600 });
}

try {
  prepareLicense();
} catch (error) {
  // No imprimir el error original de una dependencia: puede contener datos de configuración.
  process.stderr.write(`${error instanceof Error ? error.message : 'No se pudo preparar la licencia de PrimeNG.'}\n`);
  process.exitCode = 1;
}
