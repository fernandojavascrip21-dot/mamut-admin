import { describe, expect, it } from 'vitest'
import { MONEY_MAX } from '@lib/constants'
import { compareMoney, decimalPlaces, fromMinorUnits, toMinorUnits } from '@lib/money'

// Mismos casos que src/app/shared/utils/money.spec.ts del frontend (spec T-08 §7).
describe('money', () => {
  it('convierte texto a unidades mínimas sin pasar por flotantes', () => {
    expect(toMinorUnits('450.5', 2)).toBe(45050)
    expect(toMinorUnits('450', 2)).toBe(45000)
    expect(toMinorUnits('0.0001', 4)).toBe(1)
    expect(toMinorUnits('83.3333', 4)).toBe(833333)
    expect(toMinorUnits('0.3', 2)).toBe(30)
  })

  it('rechaza decimales de más y formatos que no son decimales simples', () => {
    for (const value of ['450.555', '1e3', '450,50', '', '-1', 'abc', '1,000.00', '.5', '450.', ' 450']) {
      expect(() => toMinorUnits(value, 2), value).toThrow()
    }
    expect(() => toMinorUnits('1.00001', 4)).toThrow()
  })

  it('cuenta los decimales de un texto decimal válido', () => {
    expect(decimalPlaces('450')).toBe(0)
    expect(decimalPlaces('450.50')).toBe(2)
    expect(decimalPlaces('1.00001')).toBe(5)
    expect(decimalPlaces('1e3')).toBeNull()
    expect(decimalPlaces('450,50')).toBeNull()
  })

  it('vuelve a texto y hace ida y vuelta exacta', () => {
    expect(fromMinorUnits(45050, 2)).toBe('450.50')
    expect(fromMinorUnits(1, 4)).toBe('0.0001')
    expect(fromMinorUnits(5, 2)).toBe('0.05')
    for (const [value, scale] of [['450.50', 2], ['83.3333', 4], ['0.01', 2]] as const) {
      expect(fromMinorUnits(toMinorUnits(value, scale), scale)).toBe(value)
    }
  })

  it('compara montos de escalas 2 y 4', () => {
    expect(compareMoney('83.33', 2, '83.3300', 4)).toBe(0)
    expect(compareMoney('83.33', 2, '83.3301', 4)).toBe(-1)
    expect(compareMoney('83.34', 2, '83.3399', 4)).toBe(1)
    expect(compareMoney('0.1', 2, '0.2', 2)).toBe(-1)
  })

  it('representa el máximo de cada columna sin perder precisión', () => {
    expect(toMinorUnits(MONEY_MAX[2], 2)).toBe(9_999_999_999)
    expect(toMinorUnits(MONEY_MAX[4], 4)).toBe(9_999_999_999)
    expect(fromMinorUnits(9_999_999_999, 2)).toBe(MONEY_MAX[2])
    expect(fromMinorUnits(9_999_999_999, 4)).toBe(MONEY_MAX[4])
    expect(compareMoney(MONEY_MAX[2], 2, MONEY_MAX[4], 4)).toBe(1)
  })
})
