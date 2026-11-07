import { describe, expect, it } from 'vitest'
import { divideMoney } from '@lib/money'

describe('divideMoney', () => {
  it('divide exacto sin residuo', () => {
    expect(divideMoney('450.0000', 4, 5)).toBe('90.0000')
    expect(divideMoney('450.00', 2, 9)).toBe('50.00')
  })

  it('redondea una sola vez a 4 decimales (450.0000 ÷ 7 = 64.2857)', () => {
    expect(divideMoney('450.0000', 4, 7)).toBe('64.2857')
  })

  it('redondea mitad hacia arriba cuando cae justo en la mitad', () => {
    expect(divideMoney('0.0001', 4, 2)).toBe('0.0001')
    expect(divideMoney('0.01', 2, 2)).toBe('0.01')
    expect(divideMoney('1.0000', 4, 8)).toBe('0.1250')
    expect(divideMoney('0.0003', 4, 2)).toBe('0.0002')
  })

  it('redondea hacia abajo cuando el residuo es menor que la mitad', () => {
    expect(divideMoney('1.0000', 4, 3)).toBe('0.3333')
  })

  it('respeta la escala 2', () => {
    expect(divideMoney('10.00', 2, 3)).toBe('3.33')
    expect(divideMoney('10.00', 2, 6)).toBe('1.67')
  })

  it('devuelve 0 con la escala de la entrada si el cociente no alcanza', () => {
    expect(divideMoney('0.0001', 4, 3)).toBe('0.0000')
  })

  it('lanza con un divisor no entero', () => {
    expect(() => divideMoney('450.0000', 4, 2.5)).toThrow()
    expect(() => divideMoney('450.0000', 4, Number.NaN)).toThrow()
  })

  it('lanza con un divisor menor que 1', () => {
    expect(() => divideMoney('450.0000', 4, 0)).toThrow()
    expect(() => divideMoney('450.0000', 4, -3)).toThrow()
  })
})
