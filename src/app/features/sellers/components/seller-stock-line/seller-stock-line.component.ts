import { Component, computed, input, signal } from '@angular/core';
import { initialsOf } from '@shared/utils/initials';
import type { SellerStockLine } from '../../interfaces/seller.models';
import { unitsLabel } from '../../rules/seller.rules';

// Un producto del stock de un vendedor (detalle de HU-09): foto (o iniciales), nombre y piezas.
// Solo lectura: dejar y retirar producto son HU-11 y HU-12.
@Component({
  imports: [],
  selector: 'app-seller-stock-line',
  templateUrl: './seller-stock-line.component.html',
})
export class SellerStockLineComponent {
  readonly line = input.required<SellerStockLine>();

  // Si la URL de la foto no carga, cae a las iniciales en vez de dejar una imagen rota.
  private readonly imageBroken = signal(false);

  readonly showPhoto = computed(() => this.line().image !== null && !this.imageBroken());
  readonly initials = computed(() => initialsOf(this.line().name));
  readonly units = computed(() => unitsLabel(this.line().units));

  onPhotoError(): void {
    this.imageBroken.set(true);
  }
}
