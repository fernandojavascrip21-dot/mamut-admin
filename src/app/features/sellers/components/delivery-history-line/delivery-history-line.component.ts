import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { initialsOf } from '@shared/utils/initials';
import { unitsLabel } from '@shared/utils/units-label';
import { DELIVERY_URL } from '../../constants/sellers.constants';
import type { DeliveryHistoryItem } from '../../interfaces/seller.models';

// Una entrega del historial «Últimas entregas» del detalle de un vendedor (HU-11): fecha, foto (o
// iniciales), producto y piezas. Con `requestId` es un enlace al resumen de esa entrega; las
// anteriores a la llave de idempotencia (sin `requestId`) no tienen resumen y se ven sin enlace.
@Component({
  imports: [DatePipe, NgTemplateOutlet, RouterLink],
  selector: 'app-delivery-history-line',
  templateUrl: './delivery-history-line.component.html',
})
export class DeliveryHistoryLineComponent {
  readonly item = input.required<DeliveryHistoryItem>();

  readonly summaryUrl = DELIVERY_URL;
  readonly units = computed(() => unitsLabel(this.item().qty));
  readonly initials = computed(() => initialsOf(this.item().name));

  // Si la URL de la foto no carga, cae a las iniciales en vez de dejar una imagen rota.
  private readonly imageBroken = signal(false);
  readonly showPhoto = computed(() => this.item().image !== null && !this.imageBroken());

  onPhotoError(): void {
    this.imageBroken.set(true);
  }
}
