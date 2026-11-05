import { CurrencyPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Card } from 'primeng/card';
import { CUT_CARD_PASS_THROUGH } from '../../constants/cash-cut.constants';
import { unitsLabel } from '@shared/utils/units-label';
import type { CashCut } from '../../interfaces/cash-cut.models';
import { CUT_SUMMARY_TEXTS } from './cut-summary.constants';

// Resumen del corte: vendido, costo y ganancia (HU-19). Las cifras son las de `totals` tal como las
// manda el backend; aquí no se suma ni se resta nada, solo se formatean para mostrarlas.
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

  // «Vendió Luis · 2 al 8 nov · 5 piezas» o «Mis ventas desde bodega · … · N piezas».
  readonly soldCaption = computed(() => {
    const who = this.holderName()
      ? `${this.texts.sellerSold} ${this.holderName()}`
      : this.texts.warehouseSold;
    return `${who} · ${this.periodText()} · ${unitsLabel(this.totals().units)}`;
  });
  readonly costLabel = computed(() =>
    this.holderName() ? this.texts.costWithShipping : this.texts.cost,
  );

  // `Number()` solo para pasar el monto al pipe `currency` al mostrarlo.
  readonly total = computed(() => Number(this.totals().total));
  readonly cost = computed(() => Number(this.totals().cost));
  readonly profit = computed(() => Number(this.totals().profit));
  // El signo menos del texto decide el color; no se compara como número.
  readonly profitIsNegative = computed(() => this.totals().profit?.startsWith('-') ?? false);
}
