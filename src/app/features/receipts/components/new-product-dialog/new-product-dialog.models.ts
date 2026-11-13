import type { FormControl, FormGroup } from '@angular/forms';

// Campos del alta que tienen mensajes de validación propios.
export type NewProductField = 'name' | 'price' | 'unitCost';

// Todo texto, como los demás formularios de la app: el dinero viaja como texto y la categoría como id en texto.
export type NewProductFormGroup = FormGroup<{
  name: FormControl<string>;
  price: FormControl<string>;
  categoryId: FormControl<string>;
  unitCost: FormControl<string>;
}>;

// Valores en vivo que alimentan la regla «precio menor que el costo».
export interface NewProductLiveValues {
  price: string;
  unitCost: string;
}
