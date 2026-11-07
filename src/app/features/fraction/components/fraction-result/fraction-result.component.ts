import { Component, input, output } from '@angular/core';
import type { Fraction } from '../../interfaces/fraction.models';

// Esqueleto de HU-23: resultado presentacional del fraccionado. Sin lógica todavía.
@Component({
  imports: [],
  selector: 'app-fraction-result',
  templateUrl: './fraction-result.component.html',
})
export class FractionResultComponent {
  readonly fraction = input.required<Fraction>();
  readonly replayed = input(false);
  readonly again = output<void>();
}
