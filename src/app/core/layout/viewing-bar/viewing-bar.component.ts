import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { initialsOf } from '@shared/utils/initials';
import type { ViewingListStatus, ViewingSeller } from '@core/viewing/interfaces/viewing.models';
import {
  LOAD_ERROR_HINT,
  RETRY_LABEL,
  VIEWING_LABEL,
  VIEWING_SELECT_MOTION_OPTIONS,
  VIEWING_SELECT_PANEL_STYLE,
  WAREHOUSE_OPTION_LABEL,
  WAREHOUSE_OPTION_VALUE,
} from './viewing-bar.constants';
import type { ViewingOption, ViewingSelectChange } from './viewing-bar.models';

// Barra «Viendo» del administrador (HU-10): elige entre «Yo · bodega» y cada vendedor activo.
// Presentacional, como top-nav: admin-shell le pasa la lista y la selección de ViewingService y
// atiende sus eventos. «Yo · bodega» siempre se puede elegir, aunque la lista cargue o falle.
@Component({
  imports: [FormsModule, Select],
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
  readonly retryLabel = RETRY_LABEL;
  readonly errorHint = LOAD_ERROR_HINT;
  readonly motionOptions = VIEWING_SELECT_MOTION_OPTIONS;
  readonly panelStyle = VIEWING_SELECT_PANEL_STYLE;

  readonly selectedSeller = computed(
    () => this.sellers().find((seller) => seller.id === this.selectedSellerId()) ?? null,
  );
  readonly initials = computed(() => initialsOf(this.selectedSeller()?.fullName ?? ''));

  // «Yo · bodega» va primero y usa el valor '' (el select maneja texto); el resto, un vendedor cada uno.
  readonly options = computed<ViewingOption[]>(() => [
    { id: WAREHOUSE_OPTION_VALUE, label: WAREHOUSE_OPTION_LABEL },
    ...this.sellers().map((seller) => ({ id: seller.id, label: seller.fullName })),
  ]);
  readonly value = computed(() => this.selectedSellerId() ?? WAREHOUSE_OPTION_VALUE);

  // El valor vacío es «Yo · bodega» (null).
  onChange(event: ViewingSelectChange): void {
    const value = event.value as string;
    this.selectionChange.emit(value === WAREHOUSE_OPTION_VALUE ? null : value);
  }
}
