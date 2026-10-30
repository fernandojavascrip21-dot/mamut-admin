import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, posix, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Fronteras del monolito modular (no toca la base). Cada módulo de negocio de src/ expone su
// API en index.ts y se importa con su alias (@auth, @products…), que solo apunta a ese index;
// la infraestructura (@db/*, @lib/*) no depende de ningún módulo de negocio, y un import
// relativo nunca sale de su área (para eso están los alias, igual que en el frontend).
const ROOT = join(__dirname, '..')
const INFRASTRUCTURE = ['db', 'lib']
const ALIASES: Record<string, string> = {
  '@db/': 'src/db/',
  '@lib/': 'src/lib/',
  '@api/': 'app/api/',
  '@auth': 'src/auth',
  '@accounts': 'src/accounts',
  '@products': 'src/products',
  '@categories': 'src/categories',
  '@stock': 'src/stock',
}

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : /\.m?ts$/.test(entry.name) ? [join(dir, entry.name)] : [],
  )

const toPosix = (path: string) => path.split('\\').join('/')

// Área de un archivo dentro de backend/: cada carpeta de src/ es una, app/ otra, tests/ otra.
const areaOf = (path: string) => {
  const [top, name] = path.split('/')
  return top === 'src' ? `src/${name}` : top
}

interface Import {
  file: string
  spec: string
  target: string
  relative: boolean
}

// Imports internos de un archivo (relativos o con alias), llevados a su ruta dentro de backend/.
const importsOf = (absolute: string): Import[] => {
  const file = toPosix(relative(ROOT, absolute))
  return [...readFileSync(absolute, 'utf8').matchAll(/from '([^']+)'/g)].flatMap(([, spec]): Import[] => {
    if (spec.startsWith('.')) {
      return [{ file, spec, target: posix.normalize(posix.join(dirname(file), spec)), relative: true }]
    }
    const alias = Object.keys(ALIASES).find((prefix) => spec === prefix || spec.startsWith(prefix))
    return alias ? [{ file, spec, target: ALIASES[alias] + spec.slice(alias.length), relative: false }] : []
  })
}

const allImports = ['app', 'src', 'tests', 'scripts'].flatMap((dir) => walk(join(ROOT, dir)).flatMap(importsOf))
const describeImport = ({ file, spec }: Import) => `${file} → ${spec}`

describe('arquitectura del backend', () => {
  // Los archivos de la raíz (proxy.ts) no tienen alias y se importan con ruta relativa.
  it('un import relativo no sale de su área: entre áreas se usan los alias', () => {
    const violations = allImports.filter(
      (imp) => imp.relative && imp.target.includes('/') && areaOf(imp.target) !== areaOf(imp.file),
    )
    expect(violations.map(describeImport)).toEqual([])
  })

  it('db y lib no dependen de módulos de negocio', () => {
    const violations = allImports.filter((imp) => {
      const from = areaOf(imp.file)
      const to = areaOf(imp.target)
      return INFRASTRUCTURE.some((infra) => from === `src/${infra}`) && to.startsWith('src/') && !INFRASTRUCTURE.some((infra) => to === `src/${infra}`)
    })
    expect(violations.map(describeImport)).toEqual([])
  })

  it('src/ no importa rutas de app/api', () => {
    const violations = allImports.filter((imp) => imp.file.startsWith('src/') && imp.target.startsWith('app/'))
    expect(violations.map(describeImport)).toEqual([])
  })
})
