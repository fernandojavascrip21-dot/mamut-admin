import type { Fraction, FractionBeforeAfter, FractionPreview } from '../interfaces/fraction.models';

// Esqueleto de HU-23: baja 1 entero y suben `portions` bolsitas. Sin implementar.
export function fractionPreview(warehouseUnits: number, portions: number): FractionPreview {
  void warehouseUnits;
  void portions;
  throw new Error('fractionPreview sin implementar');
}

// Esqueleto de HU-23: bodega antes → después del resultado. Sin implementar.
export function fractionBeforeAfter(fraction: Fraction, replayed: boolean): FractionBeforeAfter {
  void fraction;
  void replayed;
  throw new Error('fractionBeforeAfter sin implementar');
}
