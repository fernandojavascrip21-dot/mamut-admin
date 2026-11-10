import { Component, input, output } from '@angular/core';
import type { RestockProduct, RestockSuggestion } from '../../interfaces/restock.models';
import type {
  RestockBusyAction, RestockFormSubmit, RestockLineForm, RestockNoticeAction,
} from './restock-form.models';

@Component({
  imports: [],
  selector: 'app-restock-form',
  templateUrl: './restock-form.component.html',
})
export class RestockFormComponent {
  readonly products = input.required<RestockProduct[]>();
  readonly suggestions = input.required<RestockSuggestion[]>();
  readonly initialLines = input.required<RestockLineForm[]>();
  readonly initialNote = input('');
  readonly busy = input<RestockBusyAction | null>(null);
  readonly hasDraft = input(false);
  readonly notice = input<string | null>(null);
  readonly noticeAction = input<RestockNoticeAction | null>(null);

  readonly saved = output<RestockFormSubmit>();
  readonly closed = output<RestockFormSubmit>();
  readonly discarded = output<void>();
  readonly noticeActionClicked = output<RestockNoticeAction>();
  // true al primer cambio del usuario; una lista recién cargada no cuenta.
  readonly dirtyChange = output<boolean>();
}
