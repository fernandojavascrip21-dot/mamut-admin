import { describe, expect, it } from 'vitest'
import type { AuthContext } from '../src/auth/context'
import { assertRole, requireOwnClient } from '../src/auth/guards'
import { AppError } from '../src/lib/errors'

const admin: AuthContext = { userId: 'a', role: 'admin', clientId: null, fullName: 'Admin' }
const client: AuthContext = { userId: 'c', role: 'client', clientId: 7, fullName: 'Cliente' }

describe('assertRole', () => {
  it('permite el rol indicado', () => {
    expect(() => assertRole(admin, ['admin'])).not.toThrow()
    expect(() => assertRole(client, ['admin', 'client'])).not.toThrow()
  })

  it('un cliente en una ruta de admin recibe 403', () => {
    expect.assertions(2)
    try {
      assertRole(client, ['admin'])
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).status).toBe(403)
    }
  })
})

describe('requireOwnClient', () => {
  it('el admin accede a cualquier cliente', () => {
    expect(() => requireOwnClient(admin, 7)).not.toThrow()
    expect(() => requireOwnClient(admin, 99)).not.toThrow()
  })

  it('un cliente accede al suyo', () => {
    expect(() => requireOwnClient(client, 7)).not.toThrow()
  })

  it('un cliente no accede a otro cliente (403)', () => {
    expect(() => requireOwnClient(client, 8)).toThrowError(AppError)
  })
})
