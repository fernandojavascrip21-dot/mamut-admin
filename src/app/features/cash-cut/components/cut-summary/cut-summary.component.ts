import { CurrencyPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Card } from 'primeng/card';
import { CUT_CARD_PASS_THROUGH } from '../../constants/cash-cut.constants';
import { unitsLabel } from '@shared/utils/units-label';
import type {
  CashCut,
  CutLayout,
  CutPerspective,
  CutTypeValue,
} from '../../interfaces/cash-cut.models';
import { CUT_SUMMARY_TEXTS } from './cut-summary.constants';

// Resumen del corte: vendido, costo y ganancia (HU-19); con `layout` overview, vendido y ganancia (HU-21).
// Las cifras son las de `totals` tal como las manda el backend; aquí no se suma ni se resta nada, solo se formatean para mostrarlas.
@Component({
  imports: [Card, CurrencyPipe],
  selector: 'app-cut-summary',
  templateUrl: './cut-summary.component.html',
})
export class CutSummaryComponent {
  readonly cardPassThrough = CUT_CARD_PASS_THROUGH;
  readonly texts = CUT_SUMMARY_TEXTS;

  readonly totals = input.required<CashCut['totals']>();
  // Primer nombre del vendedor («Luis»); null con «Yo · bodega».
  readonly holderName = input.required<string | null>();
  // Texto del periodo («2 al 8 nov»).
  readonly periodText = input.required<string>();
  // 'seller' (HU-20): «Vendí…» y «Total a entregar»; 'admin' conserva los textos de HU-19.
  readonly perspective = input<CutPerspective>('admin');
  // 'home' (HU-21): en `overview` la ganancia sale de `realProfit` en vez de `profit`.
  readonly cutType = input<CutTypeValue>('seller');
  // 'overview' (HU-21): franja, Vendido y Ganancia sin costos, y pie proyectado; 'classic' no cambia.
  readonly layout = input<CutLayout>('classic');
  readonly isOverview = computed(() => this.layout() === 'overview');

  // «Vendió Luis · 2 al 8 nov · 5 piezas» o «Mis ventas desde bodega · … · N piezas».
  readonly soldCaption = computed(() => {
    const who =
      this.perspective() === 'seller'
        ? this.texts.mySold
        : this.holderName()
          ? `${this.texts.sellerSold} ${this.holderName()}`
          : this.texts.warehouseSold;
    return `${who} · ${this.periodText()} · ${unitsLabel(this.totals().units)}`;
  });
  readonly costLabel = computed(() => {
    if (this.perspective() === 'seller') return this.texts.amountToDeliver;
    return this.holderName() ? this.texts.costWithShipping : this.texts.cost;
  });

  // `Number()` solo para pasar el monto al pipe `currency` al mostrarlo.
  readonly total = computed(() => Number(this.totals().total));
  readonly cost = computed(() => Number(this.totals().cost));
  readonly profit = computed(() => Number(this.totals().profit));
  // Ganancia del layout `overview`: la real con «Corte de casa», la del vendedor con el otro tipo.
  private readonly overviewProfitText = computed(() =>
    this.cutType() === 'home' ? this.totals().realProfit : this.totals().profit,
  );
  readonly hasOverviewProfit = computed(() => this.overviewProfitText() !== undefined);
  readonly overviewProfit = computed(() => Number(this.overviewProfitText()));
  readonly overviewProfitIsNegative = computed(
    () => this.overviewProfitText()?.startsWith('-') ?? false,
  );
  // El signo menos del texto decide el color; no se compara como número.
  readonly profitIsNegative = computed(() => this.totals().profit?.startsWith('-') ?? false);
}
