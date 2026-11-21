import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Variables de conexión que cambian entre la base de producción y la de Docker.
const CONNECTION_VARS = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const HEADERS = { prod: /^#\s*={3,}\s*PRODUCCI[ÓO]N/i, local: /^#\s*={3,}\s*LOCAL/i };
const ANY_HEADER = /^#\s*={3,}/;
const CONNECTION_LINE = new RegExp(`^(#\\s*)?(${CONNECTION_VARS.join('|')})=`);

// Activa el bloque `target` ('local' | 'prod') y comenta el otro, tocando solo las variables de conexión.
// Se hace así (y no con dos archivos) para que Next, Vitest, drizzle y db:check sigan leyendo un único .env.
export function switchBlock(text, target) {
  if (!(target in HEADERS)) throw new Error("El destino debe ser 'local' o 'prod'.");

  const lines = text.split('\n');
  let current = null;
  const seen = { prod: 0, local: 0 };

  const result = lines.map((line) => {
    if (ANY_HEADER.test(line)) {
      current = HEADERS.prod.test(line) ? 'prod' : HEADERS.local.test(line) ? 'local' : null;
      return line;
    }
    if (current === null) return line;

    const match = CONNECTION_LINE.exec(line);
    if (!match) return line;

    seen[current] += 1;
    const isActive = !match[1];
    const shouldBeActive = current === target;
    if (isActive === shouldBeActive) return line;
    return shouldBeActive ? line.replace(/^#\s*/, '') : `# ${line}`;
  });

  // Si falta un bloque o una variable, mejor fallar que dejar el .env a medias.
  for (const block of ['prod', 'local']) {
    if (seen[block] !== CONNECTION_VARS.length) {
      throw new Error(`En el .env, el bloque ${block === 'prod' ? 'PRODUCCIÓN' : 'LOCAL'} debe tener sus ${CONNECTION_VARS.length} variables de conexión.`);
    }
  }
  return result.join('\n');
}

function run() {
  const [target, pathArg] = process.argv.slice(2);
  const envPath = pathArg ?? fileURLToPath(new URL('../backend/.env', import.meta.url));

  // En CI no hay .env (las variables vienen del entorno): no hay nada que cambiar.
  if (!existsSync(envPath)) return;

  const original = readFileSync(envPath, 'utf8');
  const updated = switchBlock(original, target);
  if (updated !== original) writeFileSync(envPath, updated);

  // Nunca se imprimen valores: solo qué bloque quedó activo.
  if (target === 'prod') {
    process.stdout.write('\x1b[31m⚠ backend/.env → PRODUCCIÓN: este backend usará la base REAL.\x1b[0m\n');
  } else {
    process.stdout.write('backend/.env → LOCAL (Docker)\n');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    run();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'No se pudo cambiar el bloque del .env.'}\n`);
    process.exitCode = 1;
  }
}
