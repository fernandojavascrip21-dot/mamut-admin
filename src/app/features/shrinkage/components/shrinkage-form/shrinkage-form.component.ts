import { Component, input, output } from '@angular/core';
import type { ShrinkageOptions } from '../../interfaces/shrinkage.models';
import type { ShrinkageFormSubmit, ShrinkageServerErrors } from './shrinkage-form.models';

@Component({
  imports: [],
  selector: 'app-shrinkage-form',
  templateUrl: './shrinkage-form.component.html',
})
export class ShrinkageFormComponent {
  readonly options = input.required<ShrinkageOptions>();
  readonly saving = input(false);
  readonly serverErrors = input<ShrinkageServerErrors>({});
  readonly notice = input<string | null>(null);
  readonly submitted = output<ShrinkageFormSubmit>();
  readonly cancelled = output<void>();
}
