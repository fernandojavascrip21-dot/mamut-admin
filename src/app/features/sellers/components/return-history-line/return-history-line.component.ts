import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { initialsOf } from '@shared/utils/initials';
import { unitsLabel } from '@shared/utils/units-label';
import { SELLERS_LIST_URL } from '../../constants/sellers.constants';
import type { ReturnHistoryItem } from '../../interfaces/seller.models';

// Un retiro del historial «Últimos retiros» del detalle de un vendedor (HU-12): fecha, foto (o
// iniciales), producto y piezas. Con `requestId` es un enlace al resumen de ese retiro; uno creado
// fuera de este flujo (sin `requestId`) no tiene resumen y se ve sin enlace.
@Component({
  imports: [DatePipe, NgTemplateOutlet, RouterLink],
  selector: 'app-return-history-line',
  templateUrl: './return-history-line.component.html',
})
export class ReturnHistoryLineComponent {
  readonly item = input.required<ReturnHistoryItem>();
  readonly sellerId = input.required<string>();

  readonly summaryUrl = computed(() => `${SELLERS_LIST_URL}/${this.sellerId()}/retiros`);
  readonly units = computed(() => unitsLabel(this.item().qty));
  readonly initials = computed(() => initialsOf(this.item().name));

  // Si la URL de la foto no carga, cae a las iniciales en vez de dejar una imagen rota.
  private readonly imageBroken = signal(false);
  readonly showPhoto = computed(() => this.item().image !== null && !this.imageBroken());

  onPhotoError(): void {
    this.imageBroken.set(true);
  }
}
