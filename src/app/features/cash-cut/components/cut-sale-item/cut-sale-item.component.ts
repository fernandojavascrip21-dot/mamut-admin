import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { Tag } from 'primeng/tag';
import type {
  CutLayout,
  CutPerspective,
  CutSale,
  CutTypeValue,
} from '../../interfaces/cash-cut.models';
import { saleTimeLabel } from '../../rules/cut-sale-time.rules';
import { CUT_SALE_ITEM_TEXTS } from './cut-sale-item.constants';

// Una venta del corte, plegada por defecto (HU-19): hora (o fecha y hora), total, ganancia y la marca
// «Registrada por ti» si la hizo el administrador. Al tocarla se despliegan sus productos. Cada venta
// guarda su propio estado, así que se pueden abrir varias a la vez.
@Component({
  imports: [CurrencyPipe, Tag],
  selector: 'app-cut-sale-item',
  templateUrl: './cut-sale-item.component.html',
})
export class CutSaleItemComponent {
  readonly texts = CUT_SALE_ITEM_TEXTS;

  readonly sale = input.required<CutSale>();
  // true en cortes de Semana o Mes, donde la hora sola no ubica la venta.
  readonly showDate = input.required<boolean>();
  // 'seller' (HU-20): la marca dice «Registrada por el administrador»; 'admin', «Registrada por ti».
  readonly perspective = input<CutPerspective>('admin');
  // 'home' (HU-21): en `overview` la ganancia de la venta y de cada producto sale de `realProfit`.
  readonly cutType = input<CutTypeValue>('seller');
  readonly layout = input<CutLayout>('classic');
  readonly isOverview = computed(() => this.layout() === 'overview');

  readonly expanded = signal(false);

  readonly registeredLabel = computed(() =>
    this.perspective() === 'seller' ? this.texts.registeredByAdmin : this.texts.registeredByYou,
  );
  readonly timeLabel = computed(() => saleTimeLabel(this.sale().soldAt, this.showDate()));
  // `Number()` solo para pasar el monto al pipe `currency` al mostrarlo.
  readonly total = computed(() => Number(this.sale().total));
  readonly profit = computed(() => Number(this.sale().profit));
  // Ganancia de la venta en `overview`: la real con «Corte de casa», la del vendedor con el otro tipo.
  private readonly overviewProfitText = computed(() =>
    this.cutType() === 'home' ? this.sale().realProfit : this.sale().profit,
  );
  readonly hasOverviewProfit = computed(() => this.overviewProfitText() !== undefined);
  readonly overviewProfit = computed(() => Number(this.overviewProfitText()));
  readonly overviewProfitIsNegative = computed(
    () => this.overviewProfitText()?.startsWith('-') ?? false,
  );
  readonly profitIsNegative = computed(() => this.sale().profit?.startsWith('-') ?? false);

  toggle(): void {
    this.expanded.update((open) => !open);
  }

  lineUnitPrice(price: string): number {
    return Number(price);
  }

  // Ganancia de un producto desplegado en `overview`, según el tipo de corte; undefined si no llegó.
  lineProfit(line: CutSale['lines'][number]): string | undefined {
    return this.cutType() === 'home' ? line.realProfit : line.profit;
  }
}
