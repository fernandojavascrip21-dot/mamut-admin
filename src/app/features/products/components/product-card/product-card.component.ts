import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ProductSummary } from '../../interfaces/product.models';
import { initialsOf } from '@shared/utils/initials';

// Tarjeta horizontal de la pantalla 03 (spec M1-hu05 §6): foto o inicial con las etiquetas
// "Agotado"/"Fraccionado" encima, nombre, piezas en bodega y precio. Toda la tarjeta abre
// edición; Vender/Dejar a vendedor llegarán como acciones propias en M2/M3.
@Component({
  imports: [CurrencyPipe, RouterLink],
  selector: 'app-product-card',
  templateUrl: './product-card.component.html',
})
export class ProductCardComponent {
  readonly product = input.required<ProductSummary>();

  // Si la URL de la foto no carga, cae a la inicial en vez de dejar una imagen rota (§2).
  private readonly imageBroken = signal(false);

  readonly showPhoto = computed(() => this.product().image !== '' && !this.imageBroken());
  readonly initial = computed(() => initialsOf(this.product().name));
  readonly outOfStock = computed(() => this.product().stock <= 0);
  readonly price = computed(() => Number(this.product().price));

  onPhotoError(): void {
    this.imageBroken.set(true);
  }
}
