import type { FormArray, FormControl, FormGroup } from '@angular/forms';
import type { UpdateRestockOrderPayload } from '../../interfaces/restock.models';
import type { RestockLineView } from '../restock-line/restock-line.models';

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

// Acción en curso: el botón pulsado muestra espera y los tres se deshabilitan. «reload» bloquea la
// lista mientras la página vuelve a cargar el borrador (no se puede actuar sobre uno viejo).
export type RestockBusyAction = 'save' | 'close' | 'discard' | 'reload';

// Acción del aviso de error de la página.
export type RestockNoticeAction = 'reload' | 'retry';

// Lo que emite el formulario al guardar o cerrar: el payload, el total en vivo y cuántos renglones.
export interface RestockFormSubmit {
  payload: UpdateRestockOrderPayload;
  total: string;
  lineCount: number;
}

// Lo que hay escrito en la lista (nota y renglones). Las vistas y el total se calculan de aquí, no
// del FormArray, para que se actualicen al escribir.
export interface RestockFormValue {
  note: string;
  lines: RestockLineForm[];
}

// Un renglón listo para pintar: su vista y los avisos que dependen de toda la lista.
export interface RestockRow {
  view: RestockLineView;
  existsInCatalog: boolean;
  duplicateName: boolean;
}
