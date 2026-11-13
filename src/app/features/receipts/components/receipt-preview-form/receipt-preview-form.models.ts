// Forma de un renglón en el formulario: todo texto, como los demás formularios de la app.
export interface ReceiptLineFormValue {
  productId: string; // '' = «Producto nuevo»
  qty: string;
  unitCost: string; // '' = sin costo
}
