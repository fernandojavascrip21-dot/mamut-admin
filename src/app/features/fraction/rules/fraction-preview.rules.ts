import type { Fraction, FractionBeforeAfter, FractionPreview } from '../interfaces/fraction.models';

// Vista previa del fraccionado: baja 1 entero y suben `portions` bolsitas. Sin dinero.
export function fractionPreview(warehouseUnits: number, portions: number): FractionPreview {
  return { wholeBefore: warehouseUnits, wholeAfter: warehouseUnits - 1, portions };
}

// Bodega antes → después. Los saldos de la respuesta son los de después; el «antes» se deduce
// (entero +1, bolsita −porciones). Con `replayed` no es fiable (la repetición no lo cambió), así que va null.
export function fractionBeforeAfter(fraction: Fraction, replayed: boolean): FractionBeforeAfter {
  const wholeAfter = fraction.product.stock;
  const portionAfter = fraction.portionProduct.stock;
  return {
    wholeBefore: replayed ? null : wholeAfter + 1,
    wholeAfter,
    portionBefore: replayed ? null : portionAfter - fraction.portions,
    portionAfter,
  };
}
