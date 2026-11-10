import type { FormArray, FormControl, FormGroup } from '@angular/forms';
import type { UpdateRestockOrderPayload } from '../../interfaces/restock.models';

// Un renglón: `kind` fija si es de catálogo (productId) o escrito a mano (name). Piezas y costo son
// texto mientras se escriben.
export interface RestockLineForm {
  kind: 'catalog' | 'custom';
  productId: number | null;
  name: string;
  qty: string;
  unitCost: string;
}

export type RestockLineFormGroup = FormGroup<{
  kind: FormControl<'catalog' | 'custom'>;
  productId: FormControl<number | null>;
  name: FormControl<string>;
  qty: FormControl<string>;
  unitCost: FormControl<string>;
}>;

export type RestockFormGroup = FormGroup<{
  note: FormControl<string>;
  lines: FormArray<RestockLineFormGroup>;
}>;

// Acción que está en curso: el botón pulsado muestra espera y los tres se deshabilitan.
export type RestockBusyAction = 'save' | 'close' | 'discard';

// Acción del aviso de error de la página.
export type RestockNoticeAction = 'reload' | 'retry';

// Lo que emite el formulario al guardar o cerrar: el payload, el total en vivo y cuántos renglones.
export interface RestockFormSubmit {
  payload: UpdateRestockOrderPayload;
  total: string;
  lineCount: number;
}
