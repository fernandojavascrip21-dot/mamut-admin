import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ProductSummary } from '../../interfaces/product.models';
import { DELIVERY_NEW_URL } from '../../constants/products.constants';
import { initialsOf } from '@shared/utils/initials';

// Tarjeta horizontal de la pantalla 03 (spec M1-hu05 §6): foto o inicial con las etiquetas
// "Agotado"/"Fraccionado" encima, nombre, piezas en bodega y precio. La parte de arriba abre la
// edición y, si hay piezas en la bodega, una acción aparte abre «Dejar a vendedor» (HU-11); son
// dos enlaces hermanos porque un enlace no puede ir dentro de otro. Vender llegará en M3.
@Component({
  imports: [CurrencyPipe, RouterLink],
  selector: 'app-product-card',
  templateUrl: './product-card.component.html',
})
export class ProductCardComponent {
  readonly product = input.required<ProductSummary>();
  readonly sellerId = input<string | null>(null); // vendedor en «Viendo»: la ventana lo deja fijo

  readonly deliveryUrl = DELIVERY_NEW_URL;

  // Si la URL de la foto no carga, cae a la inicial en vez de dejar una imagen rota (§2).
  private readonly imageBroken = signal(false);

  readonly showPhoto = computed(() => this.product().image !== '' && !this.imageBroken());
  readonly initial = computed(() => initialsOf(this.product().name));
  readonly outOfStock = computed(() => this.product().stock <= 0);
  readonly price = computed(() => Number(this.product().price));

  // Solo se puede dejar lo que hay en la bodega.
  readonly canDeliver = computed(() => this.product().stock > 0);
  readonly deliveryParams = computed<Record<string, string>>(() => {
    const params: Record<string, string> = {
      producto: String(this.product().id),
      volver: 'productos',
    };
    const sellerId = this.sellerId();
    if (sellerId) params['vendedor'] = sellerId;
    return params;
  });

  onPhotoError(): void {
    this.imageBroken.set(true);
  }
}
