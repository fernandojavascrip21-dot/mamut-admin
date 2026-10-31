import type { FormControl, FormGroup } from '@angular/forms';

// Estructura del formulario de «Retirar producto», separada del payload (ReturnFormValue). Las
// piezas son texto: el usuario escribe en un input de texto y no se acepta un decimal ni un signo.
export type ReturnFormGroup = FormGroup<{
  productId: FormControl<number | null>; // null = sin elegir
  qty: FormControl<string>;
}>;

// Campos que pueden mostrar un error propio al enviar.
export type ReturnFieldWithError = 'productId' | 'qty';

// Una opción de la lista desplegable de productos del vendedor.
export interface ReturnProductOption {
  id: number;
  label: string;
}
