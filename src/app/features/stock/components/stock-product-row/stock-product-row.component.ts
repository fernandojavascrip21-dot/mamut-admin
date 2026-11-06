import { Component, computed, input, output, signal } from '@angular/core';
import { STOCK_LEVEL_LABELS, type StockLevel } from '@shared/constants/stock-level.constants';
import { initialsOf } from '@shared/utils/initials';
import { unitsLabel } from '@shared/utils/units-label';

// Una fila de la lista de «Stock general» (HU-13): foto (o iniciales), nombre y piezas a la derecha.
// Con «Yo» lleva debajo el reparto en una línea («Bodega 4 · Luis 6»); con un vendedor en «Viendo»
// no lo lleva. Solo muestra lo que recibe; con `editable` toda la fila se activa con clic, Enter o
// Espacio (sin botón aparte) y avisa con `activated`.
@Component({
  selector: 'app-stock-product-row',
  templateUrl: './stock-product-row.component.html',
})
export class StockProductRowComponent {
  readonly name = input.required<string>();
  readonly image = input<string | null>(null);
  readonly units = input.required<number>();
  readonly breakdown = input('');
  // Con 'out' (filtro «Baja existencia», HU-18) pinta «Agotado» en texto bajo las piezas.
  readonly stockLevel = input<StockLevel | null>(null);
  readonly outLabel = STOCK_LEVEL_LABELS.out;
  readonly editable = input(false);
  readonly activated = output<void>();

  // Si la URL de la foto no carga, cae a las iniciales en vez de dejar una imagen rota.
  private readonly imageBroken = signal(false);

  readonly showPhoto = computed(() => this.image() !== null && !this.imageBroken());
  readonly initials = computed(() => initialsOf(this.name()));
  readonly unitsText = computed(() => unitsLabel(this.units()));

  // Espacio sobre una fila editable no debe hacer scroll de la página.
  onSpace(event: Event): void {
    event.preventDefault();
    this.activate();
  }

  activate(): void {
    if (this.editable()) this.activated.emit();
  }

  onPhotoError(): void {
    this.imageBroken.set(true);
  }
}
