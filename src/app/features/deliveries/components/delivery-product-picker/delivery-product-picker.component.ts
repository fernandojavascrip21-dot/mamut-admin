import { Component, computed, input, output, signal } from '@angular/core';
import { initialsOf } from '@shared/utils/initials';
import type { DeliveryProductSummary } from '../../interfaces/delivery.models';
import { filterDeliverableProducts } from '../../rules/delivery.rules';

// Buscador de producto de la ventana «Dejar a vendedor» (HU-11). Presentacional: recibe los
// productos activos, filtra los que tienen piezas en la bodega por nombre (sin acentos) y emite el
// que se elige. Las fotos que no cargan caen en las iniciales.
@Component({
  imports: [],
  selector: 'app-delivery-product-picker',
  templateUrl: './delivery-product-picker.component.html',
})
export class DeliveryProductPickerComponent {
  readonly products = input.required<DeliveryProductSummary[]>();
  readonly invalid = input(false); // pinta el borde de error del buscador
  readonly picked = output<number>();

  readonly query = signal('');
  readonly visible = computed(() => filterDeliverableProducts(this.products(), this.query()));
  readonly hasDeliverable = computed(
    () => filterDeliverableProducts(this.products(), '').length > 0,
  );

  private readonly brokenImages = signal<ReadonlySet<number>>(new Set());

  initialsOf(name: string): string {
    return initialsOf(name);
  }

  showPhoto(product: DeliveryProductSummary): boolean {
    return product.image !== '' && !this.brokenImages().has(product.id);
  }

  onPhotoError(productId: number): void {
    this.brokenImages.update((ids) => new Set(ids).add(productId));
  }
}
