import { Component, computed, input, signal } from '@angular/core';
import { initialsOf } from '@shared/utils/initials';
import { unitsLabel } from '@shared/utils/units-label';

// Una fila de la lista de «Stock general» (HU-13): foto (o iniciales), nombre y piezas a la derecha.
// Con «Yo» lleva debajo el reparto en una línea («Bodega 4 · Luis 6»); con un vendedor en «Viendo»
// no lo lleva. Solo muestra lo que recibe.
@Component({
  selector: 'app-stock-product-row',
  templateUrl: './stock-product-row.component.html',
})
export class StockProductRowComponent {
  readonly name = input.required<string>();
  readonly image = input<string | null>(null);
  readonly units = input.required<number>();
  readonly breakdown = input('');

  // Si la URL de la foto no carga, cae a las iniciales en vez de dejar una imagen rota.
  private readonly imageBroken = signal(false);

  readonly showPhoto = computed(() => this.image() !== null && !this.imageBroken());
  readonly initials = computed(() => initialsOf(this.name()));
  readonly unitsText = computed(() => unitsLabel(this.units()));

  onPhotoError(): void {
    this.imageBroken.set(true);
  }
}
