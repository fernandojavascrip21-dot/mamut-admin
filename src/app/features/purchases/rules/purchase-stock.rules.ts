// Piezas que tendrá la bodega tras la entrada: actuales + piezas. Solo orienta en pantalla; el saldo
// real lo decide el backend y es el que se muestra en el resultado.
export function stockAfterPurchase(current: number, qty: number): number {
  return current + qty;
}
