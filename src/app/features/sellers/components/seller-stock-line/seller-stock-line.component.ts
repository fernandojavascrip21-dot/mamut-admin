import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { initialsOf } from '@shared/utils/initials';
import { unitsLabel } from '@shared/utils/units-label';
import type { SellerStockLine } from '../../interfaces/seller.models';

// Un producto del stock de un vendedor (detalle de HU-09): foto (o iniciales), nombre y piezas,
// y desde HU-11 el precio de venta y el costo que le aplican, con la marca «propio» cuando los fijó
// el administrador para ese vendedor. Solo lectura.
@Component({
  imports: [CurrencyPipe],
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

  // Lo que aplica a sus piezas: el propio del vendedor o, si no hay, el general del producto.
  readonly hasOwnPrice = computed(() => this.line().unitPrice !== null);
  readonly hasOwnCost = computed(() => this.line().unitCostWithShipping !== null);
  readonly price = computed(() => Number(this.line().unitPrice ?? this.line().price));
  readonly cost = computed(() => Number(this.line().unitCostWithShipping ?? this.line().unitCost));

  onPhotoError(): void {
    this.imageBroken.set(true);
  }
}
