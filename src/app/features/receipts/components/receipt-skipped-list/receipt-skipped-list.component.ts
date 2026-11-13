import { Component, input } from '@angular/core';
import type { SkippedLine } from '../../interfaces/receipt.models';

@Component({
  imports: [],
  selector: 'app-receipt-skipped-list',
  templateUrl: './receipt-skipped-list.component.html',
})
export class ReceiptSkippedListComponent {
  readonly skipped = input.required<SkippedLine[]>();
}
