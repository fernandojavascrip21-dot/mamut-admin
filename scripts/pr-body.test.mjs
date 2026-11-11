import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildPrBody } from './pr-body.mjs';

// La plantilla real del repo: así la prueba falla si alguien cambia sus encabezados.
const TEMPLATE = readFileSync(new URL('../.github/pull_request_template.md', import.meta.url), 'utf8');
const SPEC = 'specs/M9-hu31-lista-de-resurtir/spec.md';

const build = (overrides = {}) =>
  buildPrBody({
    template: TEMPLATE,
    body: '',
    subjects: ['feat(restock): agregar el pop-up de la lista'],
    changedFiles: ['src/app/features/restock/restock.ts'],
    jiraBySpec: {},
    ...overrides,
  });

// Contenido de una sección «## <título>» hasta la siguiente o el final.
const section = (body, title) => {
  const match = body.match(new RegExp(`^## ${title}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'));
  return match ? match[1].trim() : null;
};

test('con el cuerpo vacío parte de la plantilla y conserva todos sus encabezados y el checklist', () => {
  const body = build();
  for (const title of ['Qué cambia', 'Spec relacionado', 'Cómo probarlo', 'Checklist']) {
    assert.notEqual(section(body, title), null, `falta «${title}»`);
  }
  assert.match(section(body, 'Checklist'), /- \[ \] Los tests pasan/);
  assert.match(section(body, 'Checklist'), /- \[ \] Se corrió el reviewer/);
  assert.doesNotMatch(section(body, 'Checklist'), /\[x\]/);
});

test('«Qué cambia» lista los commits de la rama, sin merges', () => {
  const body = build({
    subjects: [
      'feat(restock): agregar el pop-up de la lista',
      'Merge pull request #77 from user/feat/base',
      "Merge branch 'main' into feat/x",
      'fix(modal-panel): no ocultar el diálogo antes del guard',
    ],
  });
  assert.equal(
    section(body, 'Qué cambia'),
    '- feat(restock): agregar el pop-up de la lista\n- fix(modal-panel): no ocultar el diálogo antes del guard',
  );
});

test('con más de 15 commits lista 15 y resume el resto', () => {
  const subjects = Array.from({ length: 18 }, (_, i) => `feat(x): cambio ${i + 1}`);
  const lines = section(build({ subjects }), 'Qué cambia').split('\n');
  assert.equal(lines.length, 16);
  assert.equal(lines.at(-1), '- …y 3 más');
});

test('con un spec en el diff pone su ruta y la clave de Jira', () => {
  const body = build({ changedFiles: [SPEC, 'src/app/x.ts'], jiraBySpec: { [SPEC]: 'SCRUM-88' } });
  assert.equal(section(body, 'Spec relacionado'), `\`${SPEC}\` · SCRUM-88`);
});

test('un spec sin clave de Jira pone solo la ruta', () => {
  const body = build({ changedFiles: [SPEC] });
  assert.equal(section(body, 'Spec relacionado'), `\`${SPEC}\``);
});

test('con varios specs los lista uno por línea', () => {
  const other = 'specs/M9-t36-base-resurtir/spec.md';
  const body = build({ changedFiles: [SPEC, other], jiraBySpec: { [SPEC]: 'SCRUM-88', [other]: 'SCRUM-87' } });
  assert.equal(section(body, 'Spec relacionado'), `- \`${SPEC}\` · SCRUM-88\n- \`${other}\` · SCRUM-87`);
});

test('sin spec en el diff pone «Ninguno»; el índice specs/README.md no cuenta como spec', () => {
  assert.equal(section(build(), 'Spec relacionado'), 'Ninguno');
  assert.equal(section(build({ changedFiles: ['specs/README.md'] }), 'Spec relacionado'), 'Ninguno');
});

test('«Cómo probarlo» depende de lo que se tocó', () => {
  const back = section(build({ changedFiles: ['backend/src/restock/orders.ts'] }), 'Cómo probarlo');
  assert.match(back, /1\. .*cd backend && npm test/);

  const front = section(build({ changedFiles: ['src/app/features/restock/x.ts'] }), 'Cómo probarlo');
  assert.match(front, /npm test/);
  assert.match(front, /npm run check:architecture/);
  assert.match(front, /ng build/);

  const sql = section(build({ changedFiles: ['supabase/migrations/20261110000001_x.sql'] }), 'Cómo probarlo');
  assert.match(sql, /npm run db:reset/);

  const both = section(build({ changedFiles: ['backend/a.ts', 'src/app/b.ts'] }), 'Cómo probarlo');
  assert.match(both, /^1\. /m);
  assert.match(both, /^2\. /m);
});

test('si solo hay documentación, «Cómo probarlo» lo dice', () => {
  const body = build({ changedFiles: ['specs/README.md', 'CLAUDE.md'] });
  assert.match(section(body, 'Cómo probarlo'), /documentación/i);
});

test('no pisa una sección que ya escribió la persona, pero sí rellena las vacías', () => {
  const written = TEMPLATE.replace(
    /(## Qué cambia\n\n)<!--[\s\S]*?-->/,
    '$1Cambié la lista de resurtir a pop-up porque no cabía en pantalla.',
  );
  const body = build({ body: written });
  assert.equal(section(body, 'Qué cambia'), 'Cambié la lista de resurtir a pop-up porque no cabía en pantalla.');
  assert.equal(section(body, 'Spec relacionado'), 'Ninguno');
});

test('si la persona ya marcó el checklist, lo respeta', () => {
  const marked = TEMPLATE.replace('- [ ] Los tests pasan', '- [x] Los tests pasan');
  assert.match(section(build({ body: marked }), 'Checklist'), /- \[x\] Los tests pasan/);
});

test('es idempotente: volver a correrlo sobre su propio resultado no cambia nada', () => {
  const first = build({ changedFiles: [SPEC, 'src/app/x.ts'], jiraBySpec: { [SPEC]: 'SCRUM-88' } });
  const second = build({ body: first, changedFiles: [SPEC, 'src/app/x.ts'], jiraBySpec: { [SPEC]: 'SCRUM-88' } });
  assert.equal(second, first);
});
