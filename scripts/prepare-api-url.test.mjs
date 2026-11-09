import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

const MISSING_MESSAGE = 'Configura API_BASE_URL en el .env del frontend o en el entorno antes de compilar (por ejemplo http://localhost:3000).';
const ABSOLUTE_MESSAGE = 'API_BASE_URL debe ser una URL absoluta http(s), por ejemplo https://api.ejemplo.com.';
const HTTPS_MESSAGE = 'API_BASE_URL debe usar https:// fuera de localhost.';
const ORIGIN_MESSAGE = 'API_BASE_URL debe ser solo el origen del backend, sin ruta (por ejemplo https://api.ejemplo.com).';

let directory;
let script;
let generated;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'mammut-api-url-'));
  mkdirSync(join(directory, 'scripts'));
  script = join(directory, 'scripts/prepare-api-url.mjs');
  generated = join(directory, 'src/app/core/api-base-url.generated.ts');
  copyFileSync(new URL('./prepare-api-url.mjs', import.meta.url), script);
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

// Aísla los casos del .env real y de cualquier API_BASE_URL del proceso que ejecuta las pruebas.
function prepare(apiBaseUrl) {
  const env = { ...process.env };
  delete env.API_BASE_URL;
  if (apiBaseUrl !== undefined) env.API_BASE_URL = apiBaseUrl;
  return spawnSync(process.execPath, [script], { env, encoding: 'utf8' });
}

function assertFails(result, message) {
  assert.notEqual(result.status, 0);
  assert.equal(result.stderr.trim(), message);
  assert.equal(existsSync(generated), false);
}

test('sin variable ni .env falla con el mensaje de configuración y no genera archivo', () => {
  assertFails(prepare(), MISSING_MESSAGE);
});

test('lee API_BASE_URL del .env cuando no hay variable de proceso', () => {
  writeFileSync(join(directory, '.env'), 'API_BASE_URL=http://localhost:3000\n');
  const result = prepare();
  assert.equal(result.status, 0);
  assert.ok(readFileSync(generated, 'utf8').includes('export const API_BASE_URL: string = "http://localhost:3000";'));
  assert.equal(result.stdout + result.stderr, '');
});

test('la variable de proceso gana sobre el .env', () => {
  writeFileSync(join(directory, '.env'), 'API_BASE_URL=http://localhost:3000\n');
  const result = prepare('https://api.ejemplo.com');
  assert.equal(result.status, 0);
  const source = readFileSync(generated, 'utf8');
  assert.match(source, /"https:\/\/api\.ejemplo\.com"/);
  assert.doesNotMatch(source, /localhost/);
});

test('una variable de proceso vacía gana y falla aunque el .env tenga un valor', () => {
  writeFileSync(join(directory, '.env'), 'API_BASE_URL=http://localhost:3000\n');
  assertFails(prepare('   '), MISSING_MESSAGE);
});

test('acepta http://localhost:3000', () => {
  assert.equal(prepare('http://localhost:3000').status, 0);
  assert.ok(readFileSync(generated, 'utf8').includes('"http://localhost:3000"'));
});

test('acepta http://127.0.0.1:3000', () => {
  assert.equal(prepare('http://127.0.0.1:3000').status, 0);
  assert.ok(readFileSync(generated, 'utf8').includes('"http://127.0.0.1:3000"'));
});

test('rechaza http en un host distinto de localhost', () => {
  assertFails(prepare('http://api.ejemplo.com'), HTTPS_MESSAGE);
});

for (const value of ['ftp://x', 'no-es-url']) {
  test(`rechaza «${value}» como URL absoluta http(s)`, () => {
    assertFails(prepare(value), ABSOLUTE_MESSAGE);
  });
}

for (const value of ['https://api.ejemplo.com/v1', 'https://api.ejemplo.com/?a=1']) {
  test(`rechaza «${value}» por llevar ruta o query`, () => {
    assertFails(prepare(value), ORIGIN_MESSAGE);
  });
}

test('una «/» final se quita y se genera el origen normalizado', () => {
  const result = prepare('https://api.ejemplo.com/');
  assert.equal(result.status, 0);
  assert.ok(readFileSync(generated, 'utf8').includes('export const API_BASE_URL: string = "https://api.ejemplo.com";'));
});

test('el archivo generado lleva la línea de encabezado', () => {
  assert.equal(prepare('https://api.ejemplo.com').status, 0);
  assert.equal(
    readFileSync(generated, 'utf8').split('\n')[0],
    '// Archivo generado por npm run api:prepare. No versionar.',
  );
});

test('un error no imprime el valor recibido ni otras variables del .env', () => {
  writeFileSync(join(directory, '.env'), 'API_BASE_URL=http://secreto.ejemplo.com/ruta\nOTHER_VALUE=private-test-value\n');
  const result = prepare();
  assert.notEqual(result.status, 0);
  const output = result.stdout + result.stderr;
  assert.doesNotMatch(output, /secreto\.ejemplo\.com|private-test-value|OTHER_VALUE=/);
});
