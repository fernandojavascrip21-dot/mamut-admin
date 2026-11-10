import { Component, input, output } from '@angular/core';
import type { RestockLineFormGroup } from '../restock-form/restock-form.models';
import type { RestockLineView } from './restock-line.models';

@Component({
  imports: [],
  selector: 'app-restock-line',
  templateUrl: './restock-line.component.html',
})
export class RestockLineComponent {
  readonly group = input.required<RestockLineFormGroup>();
  readonly view = input.required<RestockLineView>();
  // Los errores de campo se pintan solo después de intentar enviar.
  readonly showErrors = input(false);
  // Aviso «Ya existe en el catálogo» de un renglón escrito a mano.
  readonly existsInCatalog = input(false);
  readonly removed = output<void>();
}
