import type { FormControl, FormGroup } from '@angular/forms';

// Estructura del formulario de producto, separada del modelo del backend (Product) y del payload
// (ProductFormValue). Los numéricos aceptan texto porque al editar se cargan tal cual llegan de
// Postgres ("100.00"); lo que escribe el usuario llega como número. Se convierten al preparar
// el payload.
export type ProductFormGroup = FormGroup<{
  name: FormControl<string>;
  categoryId: FormControl<string>; // '' = sin categoría; texto para que <select> use [value]
  unitCost: FormControl<number | string | null>;
  price: FormControl<number | string | null>;
  units: FormControl<number | null>;
  fractionable: FormControl<boolean>;
  portionSize: FormControl<string>;
}>;

// Campos que pueden mostrar un error propio al enviar.
export type FieldWithError = 'name' | 'unitCost' | 'price' | 'units' | 'portionSize';
