import type { FormControl, FormGroup } from '@angular/forms';

// Forma del formulario, separada del payload: las bolsitas y el precio van como texto (se validan
// antes de convertir) y el entero es su id o null si todavía no se eligió.
export type FractionFormGroup = FormGroup<{
  productId: FormControl<number | null>;
  portionSize: FormControl<string>;
  portions: FormControl<string>;
  price: FormControl<string>;
}>;

// Valor del formulario tal como lo escribe el usuario.
export interface FractionFormValue {
  productId: number | null;
  portionSize: string;
  portions: string;
  price: string;
}

// Errores del servidor que la página pinta en cada campo del formulario.
export interface FractionServerErrors {
  product?: string | null;
  portionSize?: string | null;
  portions?: string | null;
  price?: string | null;
}

// Campos que pueden mostrar un error al enviar.
export type FractionFieldWithError = 'product' | 'portionSize' | 'portions' | 'price';

// Lo que emite el formulario; el requestId lo agrega la página. portionSize viene solo con bolsita nueva.
export interface FractionFormSubmit {
  productId: number;
  portions: number;
  price: string;
  portionSize?: string;
}

// Opción del selector: los enteros sin piezas salen deshabilitados.
export interface FractionProductOption {
  value: number;
  label: string;
  disabled: boolean;
}
