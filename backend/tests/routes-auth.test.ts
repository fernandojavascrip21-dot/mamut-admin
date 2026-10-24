import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const API_DIR = path.resolve(__dirname, '../app/api')
const METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const

// Rutas públicas: no exigen token. `refresh` se autentica con el refreshToken del cuerpo.
const PUBLIC = new Set(['/api/health', '/api/auth/login', '/api/auth/refresh'])

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? routeFiles(full) : name === 'route.ts' ? [full] : []
  })
}

const routePath = (file: string) =>
  '/api/' + path.relative(API_DIR, path.dirname(file)).split(path.sep).filter(Boolean).join('/')

describe('todas las rutas de la API', () => {
  const files = routeFiles(API_DIR)

  it('se encontraron rutas', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it('sin token responden 401 con el formato común de error (salvo las públicas)', async () => {
    const checked: string[] = []
    for (const file of files) {
      const route = routePath(file).replace(/^\/api\/\/?api/, '/api')
      if (PUBLIC.has(route)) continue
      const mod = await import(file)
      for (const method of METHODS) {
        const handler = mod[method]
        if (!handler) continue
        const res: Response = await handler(
          new Request(`http://api.test${route}`, { method }),
          { params: Promise.resolve({ id: '1' }) },
        )
        expect(res.status, `${method} ${route}`).toBe(401)
        expect(await res.json(), `${method} ${route}`).toMatchObject({
          error: { code: 'unauthorized', message: expect.any(String) },
        })
        checked.push(`${method} ${route}`)
      }
    }
    expect(checked.length).toBeGreaterThan(15)
  })

  it('las rutas públicas son solo las esperadas', () => {
    const found = files.map(routePath)
    for (const p of PUBLIC) expect(found).toContain(p)
  })
})
