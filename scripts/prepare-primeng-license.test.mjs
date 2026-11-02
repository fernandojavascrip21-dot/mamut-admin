import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

let directory;
let script;
let generated;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'mammut-primeng-'));
  mkdirSync(join(directory, 'scripts'));
  script = join(directory, 'scripts/prepare-primeng-license.mjs');
  generated = join(directory, 'src/app/core/ui/constants/primeng-license.generated.ts');
  copyFileSync(new URL('./prepare-primeng-license.mjs', import.meta.url), script);
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

// Aísla los casos del .env real y de cualquier clave del proceso que ejecuta las pruebas.
function prepare(licenseKey) {
  const env = { ...process.env };
  delete env.PRIMENG_LICENSE_KEY;
  if (licenseKey !== undefined) env.PRIMENG_LICENSE_KEY = licenseKey;
  return spawnSync(process.execPath, [script], { env, encoding: 'utf8' });
}

test('sin clave informa cómo configurarla y no genera un archivo', () => {
  const result = prepare();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Configura PRIMENG_LICENSE_KEY/);
  assert.equal(existsSync(generated), false);
});

test('lee la clave de .env sin exportar otras variables ni imprimir sus valores', () => {
  writeFileSync(join(directory, '.env'), 'PRIMENG_LICENSE_KEY="test-local-license"\nOTHER_VALUE=private-test-value\n');
  const result = prepare();
  assert.equal(result.status, 0);
  const source = readFileSync(generated, 'utf8');
  assert.match(source, /"test-local-license"/);
  assert.doesNotMatch(source, /OTHER_VALUE|private-test-value/);
  assert.equal(result.stdout + result.stderr, '');
});

test('el entorno prevalece sobre .env y serializa comillas y saltos de línea como texto', () => {
  writeFileSync(join(directory, '.env'), 'PRIMENG_LICENSE_KEY=test-local-license\n');
  const licenseKey = 'test-"quoted"\nlicense\\value';
  const result = prepare(licenseKey);
  assert.equal(result.status, 0);
  assert.ok(readFileSync(generated, 'utf8').includes(JSON.stringify(licenseKey)));
  assert.equal(result.stdout + result.stderr, '');
});

test('una variable de entorno vacía falla aunque .env tenga una clave', () => {
  writeFileSync(join(directory, '.env'), 'PRIMENG_LICENSE_KEY=test-local-license\n');
  const result = prepare('   ');
  assert.equal(result.status, 1);
  assert.equal(existsSync(generated), false);
  assert.doesNotMatch(result.stderr, /test-local-license/);
});
