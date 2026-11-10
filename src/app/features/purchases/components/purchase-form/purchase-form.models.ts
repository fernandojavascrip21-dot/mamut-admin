import type { FormControl, FormGroup } from '@angular/forms';

// Forma del formulario, separada del payload: las piezas van como texto mientras se escriben (se validan
// antes de convertir) y el producto es su id o null si todavía no se eligió.
export type PurchaseFormGroup = FormGroup<{
  productId: FormControl<number | null>;
  qty: FormControl<string>;
}>;

// Errores del servidor que la página pinta en el campo piezas.
export interface PurchaseServerErrors {
  qty?: string | null;
}

// Campos que pueden mostrar un error al enviar.
export type PurchaseFieldWithError = 'product' | 'qty';

// Lo que emite el formulario; el requestId lo agrega la página.
export interface PurchaseFormSubmit {
  productId: number;
  qty: number;
}
