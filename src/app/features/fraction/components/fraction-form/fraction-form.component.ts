import { Component, input, output } from '@angular/core';
import type { FractionOption } from '../../interfaces/fraction.models';
import type { FractionFormSubmit, FractionServerErrors } from './fraction-form.models';

// Esqueleto de HU-23: formulario presentacional de «Fraccionar». Sin lógica todavía.
@Component({
  imports: [],
  selector: 'app-fraction-form',
  templateUrl: './fraction-form.component.html',
})
export class FractionFormComponent {
  readonly options = input.required<FractionOption[]>();
  readonly initialProductId = input<number | null>(null);
  readonly saving = input(false);
  readonly serverErrors = input<FractionServerErrors>({});
  readonly submitted = output<FractionFormSubmit>();
}
