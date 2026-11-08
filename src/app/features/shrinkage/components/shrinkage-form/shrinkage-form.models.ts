import type { FormControl, FormGroup } from '@angular/forms';

// Forma del formulario, separada del payload: las piezas van como texto mientras se escriben (se validan
// antes de convertir) y el producto es su id o null si todavía no se eligió.
export type ShrinkageFormGroup = FormGroup<{
  productId: FormControl<number | null>;
  qty: FormControl<string>;
  reason: FormControl<string>;
}>;

// Valor del formulario tal como lo escribe el usuario.
export interface ShrinkageFormValue {
  productId: number | null;
  qty: string;
  reason: string;
}

// Errores del servidor que la página pinta en el campo piezas.
export interface ShrinkageServerErrors {
  qty?: string | null;
}

// Campos que pueden mostrar un error al enviar.
export type ShrinkageFieldWithError = 'product' | 'qty' | 'reason';

// Lo que emite el formulario; el requestId y el titular los agrega la página.
export interface ShrinkageFormSubmit {
  productId: number;
  qty: number;
  reason: string;
}
