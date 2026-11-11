// Rellena el cuerpo de un PR recién abierto (lo corre .github/workflows/pr-description.yml).
// Lee los commits y los archivos del PR con git, arma el cuerpo con scripts/pr-body.mjs y lo escribe con
// `gh pr edit`. Todo llega por variables de entorno y se valida; no se usa shell. Con DRY_RUN=1 solo
// imprime el cuerpo, sin tocar GitHub (sirve para probarlo en local).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPrBody } from './pr-body.mjs';

const { PR_NUMBER = '', BASE_SHA = '', HEAD_SHA = '', PR_BODY = '', DRY_RUN = '' } = process.env;

if (!/^\d+$/.test(PR_NUMBER) && !DRY_RUN) fail('PR_NUMBER debe ser un número.');
if (!/^[0-9a-f]{7,40}$/i.test(BASE_SHA) || !/^[0-9a-f]{7,40}$/i.test(HEAD_SHA)) fail('BASE_SHA y HEAD_SHA deben ser commits.');

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const lines = (text) => text.split('\n').filter((line) => line.trim() !== '');

const subjects = lines(git('log', '--reverse', '--format=%s', `${BASE_SHA}..${HEAD_SHA}`));
const changedFiles = lines(git('diff', '--name-only', `${BASE_SHA}...${HEAD_SHA}`));

// La clave de Jira de cada spec sale de su fila en specs/README.md («Sin issue» no trae clave).
const readme = readFileSync('specs/README.md', 'utf8').split('\n');
const jiraBySpec = {};
for (const file of changedFiles.filter((name) => /^specs\/[^/]+\/spec\.md$/.test(name))) {
  const folder = file.split('/')[1];
  const row = readme.find((line) => line.includes(`](${folder}/spec.md)`));
  const key = row?.match(/`(SCRUM-\d+)`/)?.[1];
  if (key) jiraBySpec[file] = key;
}

const template = readFileSync('.github/pull_request_template.md', 'utf8');
const body = buildPrBody({ template, body: PR_BODY, subjects, changedFiles, jiraBySpec });

if (body === PR_BODY) {
  console.log('El cuerpo del PR ya estaba completo: no se cambia nada.');
} else if (DRY_RUN) {
  console.log(body);
} else {
  const file = join(mkdtempSync(join(tmpdir(), 'pr-body-')), 'body.md');
  writeFileSync(file, body);
  execFileSync('gh', ['pr', 'edit', PR_NUMBER, '--body-file', file], { stdio: 'inherit' });
  console.log(`Cuerpo del PR #${PR_NUMBER} rellenado.`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
