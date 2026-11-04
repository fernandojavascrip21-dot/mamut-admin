import { LOW_STOCK_THRESHOLD } from './constants'

// Nivel de existencia de un producto en manos de un titular (HU-18).
export type StockLevel = 'ok' | 'low' | 'out'

// Nivel según las piezas: 0 → 'out', de 1 a LOW_STOCK_THRESHOLD → 'low', más → 'ok'. Con `withdrawn`
// (a un vendedor se le retiró todo) el 0 es 'ok': no hay nada que resurtir.
export function stockLevelOf(units: number, options: { withdrawn?: boolean } = {}): StockLevel {
  if (units <= 0) return options.withdrawn ? 'ok' : 'out'
  return units <= LOW_STOCK_THRESHOLD ? 'low' : 'ok'
}
