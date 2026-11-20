import { Component, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import type { EditSellerBusy } from '../../../../models/edit-seller-page.models';
import { CHANGE_PASSWORD_HELP, CHANGE_PASSWORD_LABEL, DEACTIVATE_HELP, REACTIVATE_HELP, REMOVE_HELP, STATUS_LABELS, STATUS_TITLE } from './seller-status-actions.constants';
import type { SellerStatusNotice } from './seller-status-actions.models';

// Sección «Estado del vendedor» del pop-up «Editar datos» (HU-44): presentacional, solo recibe el
// estado y emite lo que el administrador pide; la confirmación y las llamadas son de la página.
@Component({
  imports: [ButtonDirective],
  selector: 'app-seller-status-actions',
  templateUrl: './seller-status-actions.component.html',
})
export class SellerStatusActionsComponent {
  readonly title = STATUS_TITLE;
  readonly labels = STATUS_LABELS;
  readonly deactivateHelp = DEACTIVATE_HELP;
  readonly reactivateHelp = REACTIVATE_HELP;
  readonly removeHelp = REMOVE_HELP;
  readonly changePasswordLabel = CHANGE_PASSWORD_LABEL;
  readonly changePasswordHelp = CHANGE_PASSWORD_HELP;

  readonly active = input.required<boolean>();
  // Acción en curso (o `saving` si guarda el formulario): deshabilita todos los botones.
  readonly busy = input<EditSellerBusy>(null);
  // Alerta de un 409 (piezas a su cargo); `showReturn` agrega «Retirar producto».
  readonly notice = input<SellerStatusNotice>(null);

  readonly deactivate = output<void>();
  readonly reactivate = output<void>();
  readonly changePassword = output<void>();
  readonly remove = output<void>();
  readonly returnUnits = output<void>();
}
