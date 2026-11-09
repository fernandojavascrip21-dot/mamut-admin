import { DatePipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { initialsOf } from '../../utils/initials';
import { NO_REASON_LABEL, WAREHOUSE_HOLDER_LABEL } from './shrinkage-history-line.constants';
import type { ShrinkageHistoryLineItem } from './shrinkage-history-line.models';

// Una merma del historial (HU-26): producto, motivo y fecha, piezas y, con `showHolder`, el titular.
// No es un enlace: una merma no tiene pantalla de resumen. Sin motivo o sin titular (bodega) cae a
// los textos fijos de las constantes.
@Component({
  imports: [DatePipe],
  selector: 'app-shrinkage-history-line',
  templateUrl: './shrinkage-history-line.component.html',
})
export class ShrinkageHistoryLineComponent {
  readonly item = input.required<ShrinkageHistoryLineItem>();
  readonly showHolder = input(false);

  readonly initials = computed(() => initialsOf(this.item().product.name));
  readonly reasonLabel = computed(() => this.item().reasonLabel ?? NO_REASON_LABEL);
  readonly holderLabel = computed(() => this.item().holder?.fullName ?? WAREHOUSE_HOLDER_LABEL);

  // Si la URL de la foto no carga, cae a las iniciales en vez de dejar una imagen rota.
  private readonly imageBroken = signal(false);
  readonly showPhoto = computed(() => this.item().product.image !== null && !this.imageBroken());

  onPhotoError(): void {
    this.imageBroken.set(true);
  }
}
