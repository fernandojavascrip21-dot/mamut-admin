import { Component } from '@angular/core';
import type { EditSellerLeaveTarget } from '../../models/edit-seller-page.models';

// Pop-up «Editar datos» del vendedor (HU-43), en el outlet `ventana`.
@Component({
  imports: [],
  selector: 'app-edit-seller-page',
  templateUrl: './edit-seller-page.component.html',
})
export class EditSellerPageComponent implements EditSellerLeaveTarget {
  saving(): boolean {
    return false;
  }

  hasUnsavedChanges(): boolean {
    return false;
  }
}
