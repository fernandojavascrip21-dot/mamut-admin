import { Component, computed, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { unitsLabel } from '@shared/utils/units-label';
import type { Shrinkage } from '../../interfaces/shrinkage.models';
import { holderName } from '../../rules/shrinkage-holder.rules';
import { SHRINKAGE_RESULT_TEXTS } from './shrinkage-result.constants';

// Resultado de «Registrar merma» (HU-25): muestra lo que devolvió el backend, sin calcular nada. El
// «antes → después» viene de los movimientos, así que también vale cuando la respuesta es repetida.
@Component({
  imports: [ButtonDirective],
  selector: 'app-shrinkage-result',
  templateUrl: './shrinkage-result.component.html',
})
export class ShrinkageResultComponent {
  readonly shrinkage = input.required<Shrinkage>();
  readonly again = output<void>();
  readonly closed = output<void>();
  readonly texts = SHRINKAGE_RESULT_TEXTS;

  readonly quantity = computed(() => `${unitsLabel(this.shrinkage().qty)} · ${this.shrinkage().reasonLabel}`);
  readonly stockTitle = computed(() => `${this.texts.stockOf} ${holderName(this.shrinkage().holder)}`);
  readonly initial = computed(() => this.shrinkage().product.name.charAt(0));
}
