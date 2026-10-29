import type { FormControl, FormGroup } from '@angular/forms';

// Estructura del formulario de producto, separada del modelo del backend (Product) y del payload
// (ProductFormValue). Precio y costo son texto (spec T-08): al editar se cargan tal cual llegan
// de Postgres ("100.00") y el usuario escribe en un input de texto, para no perder decimales ni
// aceptar notación científica. Piezas sí es número.
export type ProductFormGroup = FormGroup<{
  name: FormControl<string>;
  categoryId: FormControl<string>; // '' = sin categoría; texto para que <select> use [value]
  unitCost: FormControl<string>;
  price: FormControl<string>;
  units: FormControl<number | null>;
  fractionable: FormControl<boolean>;
  portionSize: FormControl<string>;
}>;

// Campos que pueden mostrar un error propio al enviar.
export type FieldWithError = 'name' | 'unitCost' | 'price' | 'units' | 'portionSize';
