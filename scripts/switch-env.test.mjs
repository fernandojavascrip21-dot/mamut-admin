import assert from 'node:assert/strict';
import { test } from 'node:test';
import { switchBlock } from './switch-env.mjs';

const LOCAL_ACTIVE = `# intro
# ===== PRODUCCIÓN (Supabase real) =====
# ¡Cuidado! texto
# DATABASE_URL=prod-db
# SUPABASE_URL=prod-url
# SUPABASE_ANON_KEY=prod-anon
# SUPABASE_SERVICE_ROLE_KEY=prod-role

# ===== LOCAL (Docker) =====
DATABASE_URL=local-db
SUPABASE_URL=local-url
SUPABASE_ANON_KEY=local-anon
SUPABASE_SERVICE_ROLE_KEY=local-role

# ===== CORS =====
ALLOWED_ORIGINS=http://localhost:4200
GEMINI_API_KEY=abc
`;

test('local → prod activa producción y comenta local', () => {
  const out = switchBlock(LOCAL_ACTIVE, 'prod');
  assert.match(out, /^DATABASE_URL=prod-db$/m);
  assert.match(out, /^# DATABASE_URL=local-db$/m);
  assert.equal(out.match(/^DATABASE_URL=/gm).length, 1);
});

test('prod → local vuelve al estado original', () => {
  assert.equal(switchBlock(switchBlock(LOCAL_ACTIVE, 'prod'), 'local'), LOCAL_ACTIVE);
});

test('es idempotente', () => {
  assert.equal(switchBlock(LOCAL_ACTIVE, 'local'), LOCAL_ACTIVE);
});

test('no toca otras variables ni comentarios', () => {
  const out = switchBlock(LOCAL_ACTIVE, 'prod');
  assert.match(out, /^ALLOWED_ORIGINS=http:\/\/localhost:4200$/m);
  assert.match(out, /^GEMINI_API_KEY=abc$/m);
  assert.match(out, /^# ¡Cuidado! texto$/m);
});

test('falla si faltan los encabezados de bloque', () => {
  assert.throws(() => switchBlock('DATABASE_URL=x\n', 'local'), /debe tener sus 4 variables/);
});

test('falla con un destino inválido', () => {
  assert.throws(() => switchBlock(LOCAL_ACTIVE, 'staging'), /'local' o 'prod'/);
});
