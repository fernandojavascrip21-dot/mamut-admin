import { Component, computed, input, output, signal } from '@angular/core';
import { Select } from 'primeng/select';
import type { SelectChangeEvent } from 'primeng/types/select';
import { initialsOf } from '@shared/utils/initials';
import { normalizeText } from '@shared/utils/normalize-text';
import type { DeliveryProductSummary } from '../../interfaces/delivery.models';
import { filterDeliverableProducts } from '../../rules/delivery.rules';
import { PRODUCT_SELECT_MOTION_OPTIONS } from './delivery-product-picker.constants';
import type { ProductOption } from './delivery-product-picker.models';

// Selector de producto de la ventana «Dejar a vendedor» (HU-11). Presentacional: recibe los
// productos activos, ofrece en un Select con búsqueda los que tienen piezas en la bodega
// (filtrando por nombre sin mayúsculas ni acentos) y emite el que se elige. Las fotos que no
// cargan caen en las iniciales.
@Component({
  imports: [Select],
  selector: 'app-delivery-product-picker',
  templateUrl: './delivery-product-picker.component.html',
})
export class DeliveryProductPickerComponent {
  readonly products = input.required<DeliveryProductSummary[]>();
  readonly invalid = input(false); // pinta el borde de error del selector
  readonly picked = output<number>();

  // Solo los que tienen piezas, con el nombre normalizado con la misma función que el resto de la app.
  readonly options = computed<ProductOption[]>(() =>
    filterDeliverableProducts(this.products(), '').map((product) => ({
      ...product,
      searchText: normalizeText(product.name),
    })),
  );
  readonly hasDeliverable = computed(() => this.options().length > 0);
  readonly motionOptions = PRODUCT_SELECT_MOTION_OPTIONS;

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

  onProductChange(event: SelectChangeEvent): void {
    if (typeof event.value === 'number') this.picked.emit(event.value);
  }
}
