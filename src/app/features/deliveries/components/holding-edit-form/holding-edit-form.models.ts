import type { FormControl, FormGroup } from '@angular/forms';

// Estructura del formulario de «Editar lo dejado». Las piezas, el precio y el costo son texto, igual
// que en «Dejar» (spec T-08). '' en precio o costo = usar el general.
export type HoldingEditFormGroup = FormGroup<{
  qty: FormControl<string>;
  unitCostWithShipping: FormControl<string>;
  unitPrice: FormControl<string>;
}>;

// Campos que pueden mostrar un error propio al enviar.
export type HoldingFieldWithError = 'qty' | 'unitCostWithShipping' | 'unitPrice';
