// Texto de piezas: «1 pieza» o «N piezas» (también «0 piezas»). Lo usan «Mis vendedores» (HU-09) y
// las entregas (HU-11).
export function unitsLabel(units: number): string {
  return units === 1 ? '1 pieza' : `${units} piezas`;
}
