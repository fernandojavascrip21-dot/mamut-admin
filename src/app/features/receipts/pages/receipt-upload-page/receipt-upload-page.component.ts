import { Component } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-receipt-upload-page',
  templateUrl: './receipt-upload-page.component.html',
})
export class ReceiptUploadPageComponent {
  busy(): boolean {
    return false;
  }

  hasUnsavedChanges(): boolean {
    return false;
  }
}
