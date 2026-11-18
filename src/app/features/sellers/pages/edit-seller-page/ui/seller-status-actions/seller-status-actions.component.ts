import { Component, input, output } from '@angular/core';
import type { EditSellerBusy } from '../../../../models/edit-seller-page.models';
import type { SellerStatusNotice } from './seller-status-actions.models';

// Sección «Estado del vendedor» del pop-up «Editar datos» (HU-44): presentacional, solo recibe el
// estado y emite lo que el administrador pide; la confirmación y las llamadas son de la página.
@Component({
  imports: [],
  selector: 'app-seller-status-actions',
  templateUrl: './seller-status-actions.component.html',
})
export class SellerStatusActionsComponent {
  readonly active = input.required<boolean>();
  // Acción en curso (o `saving` si guarda el formulario): deshabilita todos los botones.
  readonly busy = input<EditSellerBusy>(null);
  // Alerta de un 409 (piezas a su cargo o historial); `showReturn` agrega «Retirar producto».
  readonly notice = input<SellerStatusNotice>(null);

  readonly deactivate = output<void>();
  readonly reactivate = output<void>();
  readonly remove = output<void>();
  readonly returnUnits = output<void>();
}
