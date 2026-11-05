import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { Card } from 'primeng/card';
import { CUT_CARD_PASS_THROUGH } from '../../constants/cash-cut.constants';
import { Tag } from 'primeng/tag';
import type { CutSale } from '../../interfaces/cash-cut.models';
import { saleTimeLabel } from '../../rules/cut-sale-time.rules';
import { CUT_SALE_ITEM_TEXTS } from './cut-sale-item.constants';

// Una venta del corte, plegada por defecto (HU-19): hora (o fecha y hora), total, ganancia y la marca
// «Registrada por ti» si la hizo el administrador. Al tocarla se despliegan sus productos. Cada venta
// guarda su propio estado, así que se pueden abrir varias a la vez.
@Component({
  imports: [Card, CurrencyPipe, Tag],
  selector: 'app-cut-sale-item',
  templateUrl: './cut-sale-item.component.html',
})
export class CutSaleItemComponent {
  readonly cardPassThrough = CUT_CARD_PASS_THROUGH;
  readonly texts = CUT_SALE_ITEM_TEXTS;

  readonly sale = input.required<CutSale>();
  // true en cortes de Semana o Mes, donde la hora sola no ubica la venta.
  readonly showDate = input.required<boolean>();

  readonly expanded = signal(false);

  readonly timeLabel = computed(() => saleTimeLabel(this.sale().soldAt, this.showDate()));
  // `Number()` solo para pasar el monto al pipe `currency` al mostrarlo.
  readonly total = computed(() => Number(this.sale().total));
  readonly profit = computed(() => Number(this.sale().profit));
  readonly profitIsNegative = computed(() => this.sale().profit?.startsWith('-') ?? false);

  toggle(): void {
    this.expanded.update((open) => !open);
  }

  lineUnitPrice(price: string): number {
    return Number(price);
  }
}
