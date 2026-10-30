// Revisa las fronteras de la arquitectura por componentes de src/app (el proyecto no tiene lint):
// shared no importa core ni features; core no importa features (salvo core/layout/routes, que
// monta las rutas de cada feature); una feature no importa a otra. Sale con código 1 si algo falla.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, dirname, posix } from 'node:path';

const APP = 'src/app';
const ALIASES = { '@core/': 'core/', '@shared/': 'shared/', '@features/': 'features/' };

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : [],
  );

// Lleva un import (alias o relativo) a su ruta dentro de src/app; null si es de un paquete.
const resolve = (file, spec) => {
  const alias = Object.keys(ALIASES).find((prefix) => spec.startsWith(prefix));
  if (alias) return ALIASES[alias] + spec.slice(alias.length);
  if (spec.startsWith('.')) return posix.normalize(posix.join(dirname(file), spec));
  return null;
};

const layerOf = (path) => {
  const [top, name] = path.split('/');
  return top === 'features' ? { layer: 'features', feature: name } : { layer: top };
};

const violations = [];
for (const absolute of walk(APP)) {
  const file = relative(APP, absolute).split('\\').join('/');
  const from = layerOf(file);
  const source = readFileSync(absolute, 'utf8');
  for (const [, spec] of source.matchAll(/(?:from|import\()\s*'([^']+)'/g)) {
    const target = resolve(file, spec);
    if (!target) continue;
    const to = layerOf(target);
    const broken =
      (from.layer === 'shared' && (to.layer === 'core' || to.layer === 'features')) ||
      (from.layer === 'core' && to.layer === 'features' && !file.startsWith('core/layout/routes/')) ||
      (from.layer === 'features' && to.layer === 'features' && from.feature !== to.feature);
    if (broken) violations.push(`${file} → ${spec}`);
  }
}

if (violations.length) {
  console.error(`Imports que rompen las fronteras de la arquitectura:\n  ${violations.join('\n  ')}`);
  process.exit(1);
}
console.log('Arquitectura: sin imports entre capas prohibidos.');
