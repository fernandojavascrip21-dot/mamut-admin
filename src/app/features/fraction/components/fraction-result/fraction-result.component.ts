import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';
import type { Fraction } from '../../interfaces/fraction.models';
import { fractionBeforeAfter } from '../../rules/fraction-preview.rules';
import { FRACTION_RESULT_TEXTS } from './fraction-result.constants';

// Resultado de «Fraccionar» (HU-23): muestra lo que devolvió el backend, sin calcular dinero.
// Bodega antes → después; con `replayed` el «antes» no es fiable, así que solo va el después.
@Component({
  imports: [CurrencyPipe, ButtonDirective, Tag],
  selector: 'app-fraction-result',
  templateUrl: './fraction-result.component.html',
})
export class FractionResultComponent {
  readonly fraction = input.required<Fraction>();
  readonly replayed = input(false);
  readonly again = output<void>();
  // «Ver stock general»: la página decide cerrar el pop-up; este componente no navega.
  readonly viewStock = output<void>();
  readonly texts = FRACTION_RESULT_TEXTS;

  private readonly stock = computed(() => fractionBeforeAfter(this.fraction(), this.replayed()));
  readonly wholeStock = computed(() => stockChange(this.stock().wholeBefore, this.stock().wholeAfter));
  readonly portionStock = computed(() => stockChange(this.stock().portionBefore, this.stock().portionAfter));
}

// «3 → 2» con el antes; solo el después cuando el antes es null (respuesta repetida).
function stockChange(before: number | null, after: number): string {
  return before === null ? `${after}` : `${before} → ${after}`;
}
