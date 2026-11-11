// Arma el cuerpo de un PR a partir de la plantilla del repo, los commits de la rama y los archivos que
// toca. Es una función pura para poder probarla sin GitHub; scripts/fill-pr-body.mjs la usa en el workflow.
// Solo rellena las secciones que siguen vacías (con el texto de la plantilla): nunca pisa lo que la
// persona ya escribió ni toca el checklist.

const WHAT_CHANGES = 'Qué cambia';
const RELATED_SPEC = 'Spec relacionado';
const HOW_TO_TEST = 'Cómo probarlo';
const NO_SPEC = 'Ninguno';
const MAX_COMMITS = 15;

const SPEC_FILE = /^specs\/[^/]+\/spec\.md$/;
const MERGE_SUBJECT = /^Merge (pull request|branch|remote-tracking branch)/;

// Una sección sin escribir solo trae comentarios HTML de la plantilla (o el «1.» del paso a paso).
const isUnwritten = (text) => {
  const clean = text.replace(/<!--[\s\S]*?-->/g, '').trim();
  return clean === '' || clean === '1.';
};

const whatChanges = (subjects) => {
  const commits = subjects.filter((subject) => !MERGE_SUBJECT.test(subject));
  const lines = commits.slice(0, MAX_COMMITS).map((subject) => `- ${subject}`);
  if (commits.length > MAX_COMMITS) lines.push(`- …y ${commits.length - MAX_COMMITS} más`);
  return lines.join('\n');
};

// Los specs que toca el PR; el índice specs/README.md no es un spec. Sin ninguno, «Ninguno».
const relatedSpec = (changedFiles, jiraBySpec) => {
  const specs = changedFiles.filter((file) => SPEC_FILE.test(file));
  if (specs.length === 0) return NO_SPEC;
  const describe = (spec) => (jiraBySpec[spec] ? `\`${spec}\` · ${jiraBySpec[spec]}` : `\`${spec}\``);
  return specs.length === 1 ? describe(specs[0]) : specs.map((spec) => `- ${describe(spec)}`).join('\n');
};

// Los comandos para verificar salen de las carpetas que se tocaron.
const howToTest = (changedFiles) => {
  const touches = (prefix) => changedFiles.some((file) => file.startsWith(prefix));
  const steps = [];
  if (touches('backend/')) {
    steps.push('`cd backend && npm test` (con la base local activa y `SUPABASE_SERVICE_ROLE_KEY` en `backend/.env`).');
  }
  if (touches('src/')) {
    steps.push('`npm test`, `npm run check:architecture` y `ng build` en la raíz; y a mano con `npm run dev:all` y las cuentas de prueba del seed.');
  }
  if (touches('supabase/migrations/')) {
    steps.push('`npm run db:reset` para comprobar la migración sobre una base vacía (en producción se aplica a mano en el SQL Editor).');
  }
  if (touches('scripts/')) steps.push('`node --test scripts/*.test.mjs`.');
  if (steps.length > 0) return steps.map((step, index) => `${index + 1}. ${step}`).join('\n');

  const onlyDocs = changedFiles.every((file) => file.endsWith('.md'));
  return onlyDocs ? 'Solo documentación: revisar el texto.' : 'Revisar que los checks del PR pasen.';
};

// Reemplaza el contenido de «## <título>» solo si sigue sin escribir.
const fillSection = (lines, title, content) => {
  const start = lines.indexOf(`## ${title}`);
  if (start === -1) return;
  let end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  if (end === -1) end = lines.length;
  if (!isUnwritten(lines.slice(start + 1, end).join('\n'))) return;
  lines.splice(start + 1, end - start - 1, '', ...content.split('\n'), '');
};

export function buildPrBody({ template, body, subjects, changedFiles, jiraBySpec }) {
  const lines = (body.trim() === '' ? template : body).split('\n');
  fillSection(lines, WHAT_CHANGES, whatChanges(subjects));
  fillSection(lines, RELATED_SPEC, relatedSpec(changedFiles, jiraBySpec));
  fillSection(lines, HOW_TO_TEST, howToTest(changedFiles));
  return lines.join('\n');
}
