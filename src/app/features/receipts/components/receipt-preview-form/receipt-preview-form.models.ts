import type { FormControl, FormGroup } from '@angular/forms';
import type { PreviewLine } from '../../interfaces/receipt.models';

// Forma de un renglón en el formulario: todo texto, como los demás formularios de la app.
export interface ReceiptLineFormValue {
  productId: string; // '' = «Producto nuevo»
  qty: string;
  unitCost: string; // '' = sin costo
}

// Un FormGroup por renglón propuesto (el mismo que recibe la línea).
export type ReceiptLineFormGroup = FormGroup<{
  productId: FormControl<string>;
  qty: FormControl<string>;
  unitCost: FormControl<string>;
}>;

// Renglón del formulario con la línea propuesta de la que sale: así quitar uno los saca a los dos.
export interface ReceiptLineRow {
  proposed: PreviewLine;
  group: ReceiptLineFormGroup;
}
