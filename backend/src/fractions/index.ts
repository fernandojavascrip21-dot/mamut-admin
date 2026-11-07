// API pública del módulo de fraccionados (T-24). Las constantes de nombres de índice quedan internas.
export * from './fractions'
export type { CreateFractionInput, Fraction, FractionActor, FractionOption } from './types'
export {
  FRACTION_MISMATCH,
  MAX_PORTIONS,
  MIN_PORTIONS,
  NOT_FRACTIONABLE,
  PORTION_COST_ZERO,
  PORTIONS_OUT_OF_RANGE,
  PRICE_REQUIRED,
} from './constants'
