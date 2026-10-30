// Dinero sin flotantes (spec T-08): los montos viajan como texto decimal y se calculan en
// enteros de la unidad mínima de su escala (centavos para 2, diezmilésimas para 4).
// Mismo contrato que src/app/shared/utils/money.ts del frontend; sus pruebas cubren los mismos casos.

import { DECIMAL } from './constants'

export type MoneyScale = 2 | 4

// Cuántos decimales trae un texto decimal válido ("450.50" → 2); null si no lo es
// (notación científica, comas, signo, vacío…).
export function decimalPlaces(value: string): number | null {
  const match = DECIMAL.exec(value)
  if (!match) return null
  return match[2]?.length ?? 0
}

// "450.5" → 45050 (escala 2). Arma el entero concatenando dígitos, sin aritmética flotante.
// Lanza si el formato no es válido, si trae más decimales que la escala o si no cabe exacto.
export function toMinorUnits(value: string, scale: MoneyScale): number {
  const match = DECIMAL.exec(value)
  if (!match) throw new Error(`Monto inválido: ${value}`)
  const fraction = match[2] ?? ''
  if (fraction.length > scale) throw new Error(`El monto ${value} tiene más de ${scale} decimales`)
  const units = Number(match[1] + fraction.padEnd(scale, '0'))
  if (!Number.isSafeInteger(units)) throw new Error(`El monto ${value} es demasiado grande`)
  return units
}

// 45050 → "450.50" (escala 2).
export function fromMinorUnits(units: number, scale: MoneyScale): string {
  if (!Number.isSafeInteger(units)) throw new Error(`Unidades inválidas: ${units}`)
  const digits = Math.abs(units).toString().padStart(scale + 1, '0')
  const sign = units < 0 ? '-' : ''
  return `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`
}

// Compara dos montos de cualquier escala llevándolos a escala 4: -1, 0 o 1.
export function compareMoney(a: string, aScale: MoneyScale, b: string, bScale: MoneyScale): -1 | 0 | 1 {
  const left = toMinorUnits(a, aScale) * 10 ** (4 - aScale)
  const right = toMinorUnits(b, bScale) * 10 ** (4 - bScale)
  return left === right ? 0 : left < right ? -1 : 1
}
