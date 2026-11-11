import { Component, input, output } from '@angular/core';
import type { RestockExportFormat } from '../../interfaces/restock.models';

@Component({
  imports: [],
  selector: 'app-restock-export-buttons',
  templateUrl: './restock-export-buttons.component.html',
})
export class RestockExportButtonsComponent {
  readonly disabled = input(false);
  readonly helpText = input<string | null>(null);
  readonly busyFormat = input<RestockExportFormat | null>(null);
  readonly exportRequested = output<RestockExportFormat>();
}
