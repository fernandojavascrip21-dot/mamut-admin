import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from '../proxy'
import { corsHeaders } from '../src/lib/cors'
import { AppError, conflict, forbidden, notFound, toResponse, unauthorized, validation } from '../src/lib/errors'

describe('errores', () => {
  it.each([
    [unauthorized(), 401, 'unauthorized'],
    [forbidden(), 403, 'forbidden'],
    [notFound(), 404, 'not_found'],
    [conflict('Correo duplicado'), 409, 'conflict'],
    [validation('Dato inválido'), 422, 'validation'],
  ])('%o responde %i con el formato común', async (err, status, code) => {
    const res = toResponse(err)
    expect(res.status).toBe(status)
    const body = await res.json()
    expect(body).toEqual({ error: { code, message: err.message } })
  })

  it('un error no previsto responde 500 sin filtrar detalles', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = toResponse(new Error('password=secreto'))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('secreto')
    spy.mockRestore()
  })

  it('AppError conserva código y status', () => {
    const err = new AppError('conflict', 'x')
    expect([err.code, err.status]).toEqual(['conflict', 409])
  })
})

describe('CORS', () => {
  const original = process.env.ALLOWED_ORIGINS
  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173, https://mammut.example'
  })
  afterEach(() => {
    process.env.ALLOWED_ORIGINS = original
  })

  it('un origen permitido recibe cabeceras CORS (con espacios tolerados en la lista)', () => {
    expect(corsHeaders('https://mammut.example')?.['Access-Control-Allow-Origin']).toBe(
      'https://mammut.example',
    )
  })

  it('un origen fuera de la lista no recibe cabeceras', () => {
    expect(corsHeaders('https://malo.example')).toBeNull()
    expect(corsHeaders(null)).toBeNull()
  })

  it('sin ALLOWED_ORIGINS ningún origen se permite', () => {
    process.env.ALLOWED_ORIGINS = ''
    expect(corsHeaders('http://localhost:5173')).toBeNull()
  })

  it('el preflight de un origen permitido responde 204 con cabeceras', () => {
    const res = proxy(
      new NextRequest('http://api.test/api/me', {
        method: 'OPTIONS',
        headers: { origin: 'http://localhost:5173' },
      }),
    )
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(res.headers.get('access-control-allow-headers')).toContain('Authorization')
  })

  it('el preflight de un origen no permitido no trae cabeceras CORS', () => {
    const res = proxy(
      new NextRequest('http://api.test/api/me', {
        method: 'OPTIONS',
        headers: { origin: 'https://malo.example' },
      }),
    )
    expect(res.status).toBe(403)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('una petición normal de origen no permitido no recibe cabeceras CORS', () => {
    const res = proxy(
      new NextRequest('http://api.test/api/health', { headers: { origin: 'https://malo.example' } }),
    )
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})
