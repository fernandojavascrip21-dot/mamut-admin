import { Component, output } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-receipt-file-picker',
  templateUrl: './receipt-file-picker.component.html',
})
export class ReceiptFilePickerComponent {
  readonly fileSelected = output<File>();
}
