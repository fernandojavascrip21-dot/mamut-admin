import type { FormControl, FormGroup } from '@angular/forms';

// Estructura del formulario de «Dejar a vendedor», separada del payload (DeliveryFormValue). Las
// piezas, el precio y el costo son texto: el usuario escribe en un input de texto y no se pierden
// decimales ni se acepta notación científica (spec T-08). '' en precio o costo = usar el general.
export type DeliveryFormGroup = FormGroup<{
  sellerId: FormControl<string>; // '' = sin elegir
  productId: FormControl<number | null>;
  qty: FormControl<string>;
  unitCostWithShipping: FormControl<string>;
  unitPrice: FormControl<string>;
}>;

// Campos que pueden mostrar un error propio al enviar.
export type FieldWithError =
  'sellerId' | 'productId' | 'qty' | 'unitCostWithShipping' | 'unitPrice';

// Estado de la lectura de lo que el vendedor ya tiene del producto (prellena el precio y el costo).
export type HoldingStatus = 'idle' | 'loading' | 'error' | 'ready';
