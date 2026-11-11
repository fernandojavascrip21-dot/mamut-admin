import { Component, computed, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import type { RestockExportFormat } from '../../interfaces/restock.models';
import { RESTOCK_EXPORT_BUTTONS_TEXTS } from './restock-export-buttons.constants';

// Los dos botones de exportar del pedido. Es presentacional: solo emite el formato pedido. Mientras
// se genera un archivo, los dos quedan bloqueados y el botón pulsado muestra la espera, así un
// segundo clic no baja otro archivo. Los dos botones son separados porque los navegadores móviles
// bloquean la segunda descarga de un solo gesto.
@Component({
  imports: [ButtonDirective],
  selector: 'app-restock-export-buttons',
  templateUrl: './restock-export-buttons.component.html',
})
export class RestockExportButtonsComponent {
  // Bloqueo desde fuera (cambios sin guardar, guardando o cerrando).
  readonly disabled = input(false);
  // Ayuda que explica por qué están bloqueados; null cuando no hay que explicarlo.
  readonly helpText = input<string | null>(null);
  // Formato que se está generando ahora, o null.
  readonly busyFormat = input<RestockExportFormat | null>(null);
  readonly exportRequested = output<RestockExportFormat>();

  readonly texts = RESTOCK_EXPORT_BUTTONS_TEXTS;
  readonly helpId = 'restock-export-help';
  readonly blocked = computed(() => this.disabled() || this.busyFormat() !== null);
}
