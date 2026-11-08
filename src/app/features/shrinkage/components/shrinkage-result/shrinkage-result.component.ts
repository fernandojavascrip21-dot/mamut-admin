import { Component, input, output } from '@angular/core';
import type { Shrinkage } from '../../interfaces/shrinkage.models';

@Component({
  imports: [],
  selector: 'app-shrinkage-result',
  templateUrl: './shrinkage-result.component.html',
})
export class ShrinkageResultComponent {
  readonly shrinkage = input.required<Shrinkage>();
  readonly again = output<void>();
  readonly closed = output<void>();
}
