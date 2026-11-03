import { Component, computed, input } from '@angular/core';
import { INACTIVE_PART_KEY, WAREHOUSE_PART_KEY } from '../../constants/stock-page.constants';
import type { StockSplitPart } from '../../interfaces/stock-overview.models';
import {
  INACTIVE_COLOR_CLASS, MIN_SEGMENT_WIDTH_PX, SPLIT_COLOR_CLASSES, WAREHOUSE_COLOR_CLASS,
} from './stock-split-bar.constants';
import type { StockSplitView } from './stock-split-bar.models';

// Barra dividida de «Stock general» (HU-13) con su leyenda. La barra es decorativa (aria-hidden):
// solo dibuja los lugares con piezas, con ancho proporcional. La leyenda lista todos los lugares,
// también los de 0 piezas, con nombre y número, así que el color nunca es lo único que informa.
@Component({
  selector: 'app-stock-split-bar',
  templateUrl: './stock-split-bar.component.html',
})
export class StockSplitBarComponent {
  readonly parts = input.required<StockSplitPart[]>();

  readonly minSegmentWidth = MIN_SEGMENT_WIDTH_PX;

  // Cada parte con su clase de color: bodega y «Vendedores inactivos» tienen la suya y cada vendedor
  // toma la de su posición en la paleta.
  readonly legend = computed<StockSplitView[]>(() =>
    this.parts().map((part) => ({
      key: part.key,
      label: part.label,
      units: part.units,
      colorClass: this.colorClassOf(part),
    })),
  );

  readonly segments = computed(() => this.legend().filter((part) => part.units > 0));

  private colorClassOf(part: StockSplitPart): string {
    if (part.key === WAREHOUSE_PART_KEY) return WAREHOUSE_COLOR_CLASS;
    if (part.key === INACTIVE_PART_KEY) return INACTIVE_COLOR_CLASS;
    return SPLIT_COLOR_CLASSES[(part.colorIndex ?? 0) % SPLIT_COLOR_CLASSES.length];
  }
}
