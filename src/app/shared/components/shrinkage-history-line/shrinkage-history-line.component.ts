import { Component, input } from '@angular/core';
import type { ShrinkageHistoryLineItem } from './shrinkage-history-line.models';

// Una merma del historial (HU-26): producto, motivo y fecha, piezas y, con `showHolder`, el titular.
@Component({
  imports: [],
  selector: 'app-shrinkage-history-line',
  templateUrl: './shrinkage-history-line.component.html',
})
export class ShrinkageHistoryLineComponent {
  readonly item = input.required<ShrinkageHistoryLineItem>();
  readonly showHolder = input(false);
}
