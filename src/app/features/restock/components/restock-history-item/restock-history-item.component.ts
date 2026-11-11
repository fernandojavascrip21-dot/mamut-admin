import { Component, input } from '@angular/core';
import type { RestockHistoryItemView } from '../../models/restock-history-page.models';

@Component({
  imports: [],
  selector: 'app-restock-history-item',
  templateUrl: './restock-history-item.component.html',
})
export class RestockHistoryItemComponent {
  readonly item = input.required<RestockHistoryItemView>();
}
