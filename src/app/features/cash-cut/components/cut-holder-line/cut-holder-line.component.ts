import { CurrencyPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';
import { initialsOf } from '@shared/utils/initials';
import { unitsLabel } from '@shared/utils/units-label';
import type { BusinessCutHolder } from '../../interfaces/cash-cut.models';
import { CUT_HOLDER_LINE_TEXTS } from './cut-holder-line.constants';

// Renglón del desglose «Por titular» del resumen del negocio (HU-22): nombre, ventas y piezas, vendido
// y ganancia real. No muestra costo de fábrica ni envíos y no es interactivo. Solo presentación.
@Component({
  imports: [CurrencyPipe, Tag],
  selector: 'app-cut-holder-line',
  templateUrl: './cut-holder-line.component.html',
})
export class CutHolderLineComponent {
  readonly texts = CUT_HOLDER_LINE_TEXTS;
  readonly holder = input.required<BusinessCutHolder>();

  readonly name = computed(() => this.holder().holder?.fullName ?? this.texts.warehouse);
  // La bodega (holder null) lleva icono de almacén; un vendedor, sus iniciales.
  readonly isWarehouse = computed(() => this.holder().holder === null);
  readonly initials = computed(() => initialsOf(this.name()));
  // Solo un vendedor desactivado lleva etiqueta; la bodega (holder null) nunca.
  readonly isInactive = computed(() => this.holder().holder?.active === false);
  readonly meta = computed(() => {
    const { salesCount, units } = this.holder();
    const sales = `${salesCount} ${salesCount === 1 ? this.texts.sale : this.texts.sales}`;
    return `${sales} · ${unitsLabel(units)}`;
  });

  // `Number()` solo para pasar el monto al pipe `currency` al mostrarlo.
  readonly total = computed(() => Number(this.holder().total));
  readonly profit = computed(() => Number(this.holder().realProfit));
  // El signo del texto decide el «+» y el color; no se compara como número.
  readonly profitIsNegative = computed(() => this.holder().realProfit.startsWith('-'));
}
