import { Component, input } from '@angular/core';
import type { FractionHistoryItem } from '../../interfaces/fraction.models';

@Component({
  imports: [],
  selector: 'app-fraction-history-line',
  templateUrl: './fraction-history-line.component.html',
})
export class FractionHistoryLineComponent {
  readonly item = input.required<FractionHistoryItem>();
}
