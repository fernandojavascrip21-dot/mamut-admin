import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, posix, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Fronteras del monolito modular (no toca la base). Cada módulo de negocio de src/ expone su
// API en index.ts: las rutas y los otros módulos solo importan ese index, nunca sus archivos
// internos, y la infraestructura compartida (db, lib) no depende de ningún módulo de negocio.
const ROOT = join(__dirname, '..')
const INFRASTRUCTURE = ['db', 'lib']

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : [],
  )

// Lleva cada import relativo de un archivo a su ruta dentro de backend/ (p. ej. "src/stock/movements").
const importsOf = (file: string): string[] =>
  [...readFileSync(file, 'utf8').matchAll(/from '(\.[^']*)'/g)].map(([, spec]) =>
    posix.normalize(posix.join(dirname(relative(ROOT, file)).split('\\').join('/'), spec)),
  )

const sourceFiles = (dir: string) => walk(join(ROOT, dir))
const moduleOf = (path: string) => (path.startsWith('src/') ? path.split('/')[1] : null)

describe('arquitectura del backend', () => {
  it('las rutas importan los módulos de negocio solo por su index', () => {
    const violations = sourceFiles('app').flatMap((file) =>
      importsOf(file)
        .filter((target) => {
          const mod = moduleOf(target)
          return mod && !INFRASTRUCTURE.includes(mod) && target !== `src/${mod}`
        })
        .map((target) => `${relative(ROOT, file)} → ${target}`),
    )
    expect(violations).toEqual([])
  })

  it('un módulo usa a otro solo por su index', () => {
    const violations = sourceFiles('src').flatMap((file) => {
      const from = moduleOf(relative(ROOT, file).split('\\').join('/'))
      return importsOf(file)
        .filter((target) => {
          const to = moduleOf(target)
          return to && to !== from && !INFRASTRUCTURE.includes(to) && target !== `src/${to}`
        })
        .map((target) => `${relative(ROOT, file)} → ${target}`)
    })
    expect(violations).toEqual([])
  })

  it('db y lib no dependen de módulos de negocio', () => {
    const violations = INFRASTRUCTURE.flatMap((infra) =>
      sourceFiles(`src/${infra}`).flatMap((file) =>
        importsOf(file)
          .filter((target) => {
            const to = moduleOf(target)
            return to && !INFRASTRUCTURE.includes(to)
          })
          .map((target) => `${relative(ROOT, file)} → ${target}`),
      ),
    )
    expect(violations).toEqual([])
  })
})
