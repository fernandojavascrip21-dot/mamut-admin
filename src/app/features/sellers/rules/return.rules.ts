// Saldos después de retirar `qty` piezas (HU-12): bajan las del vendedor y suben las de la bodega,
// así que el total del negocio no cambia. Solo calcula; que `qty` sea válido y no pase de las del
// vendedor lo revisa el formulario antes de mostrar la vista previa.
export function previewReturnBalances(
  seller: number,
  warehouse: number,
  qty: number,
): { seller: number; warehouse: number } {
  return { seller: seller - qty, warehouse: warehouse + qty };
}
