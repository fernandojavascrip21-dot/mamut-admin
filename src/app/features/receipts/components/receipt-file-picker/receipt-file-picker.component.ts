import { Component, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { leaveModalLink } from '@shared/utils/modal-links';
import { RECEIPT_FILE_ACCEPT, RECEIPT_PENDING_SEGMENTS } from '../../constants/receipts.constants';

// Paso «pick» del pop-up: elige el archivo. El <input> está oculto y lo abre el botón; así se ve el
// botón de PrimeNG y no el control nativo del navegador.
@Component({
  imports: [RouterLink, ButtonDirective],
  selector: 'app-receipt-file-picker',
  templateUrl: './receipt-file-picker.component.html',
})
export class ReceiptFilePickerComponent {
  readonly fileSelected = output<File>();
  // El enlace cierra la ventana y lleva a pendientes en la misma navegación (ver leaveModalLink).
  readonly pendingLink = leaveModalLink(RECEIPT_PENDING_SEGMENTS);
  readonly accept = RECEIPT_FILE_ACCEPT;

  // Vacía el input al final: así volver a elegir el mismo archivo también emite el cambio.
  pick(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (file) this.fileSelected.emit(file);
  }
}
