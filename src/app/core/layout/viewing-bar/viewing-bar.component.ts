import { Component, computed, input, output } from '@angular/core';
import { initialsOf } from '@shared/utils/initials';
import type { ViewingListStatus, ViewingSeller } from '@core/viewing/interfaces/viewing.models';
import {
  LOAD_ERROR_HINT,
  RETRY_LABEL,
  VIEWING_LABEL,
  WAREHOUSE_OPTION_LABEL,
  WAREHOUSE_OPTION_VALUE,
} from './viewing-bar.constants';

// Barra «Viendo» del administrador (HU-10): elige entre «Yo · bodega» y cada vendedor activo.
// Presentacional, como top-nav: admin-shell le pasa la lista y la selección de ViewingService y
// atiende sus eventos. «Yo · bodega» siempre se puede elegir, aunque la lista cargue o falle.
@Component({
  selector: 'app-viewing-bar',
  templateUrl: './viewing-bar.component.html',
})
export class ViewingBarComponent {
  readonly sellers = input.required<ViewingSeller[]>();
  readonly selectedSellerId = input<string | null>(null);
  readonly status = input.required<ViewingListStatus>();

  readonly selectionChange = output<string | null>();
  readonly retry = output<void>();

  readonly label = VIEWING_LABEL;
  readonly warehouseLabel = WAREHOUSE_OPTION_LABEL;
  readonly warehouseValue = WAREHOUSE_OPTION_VALUE;
  readonly retryLabel = RETRY_LABEL;
  readonly errorHint = LOAD_ERROR_HINT;

  readonly selectedSeller = computed(
    () => this.sellers().find((seller) => seller.id === this.selectedSellerId()) ?? null,
  );
  readonly initials = computed(() => initialsOf(this.selectedSeller()?.fullName ?? ''));

  // El <select> manda texto: el valor vacío es «Yo · bodega» (null).
  onChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectionChange.emit(value === this.warehouseValue ? null : value);
  }
}
