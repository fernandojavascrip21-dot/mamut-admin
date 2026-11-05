import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { Tag } from 'primeng/tag';
import type { CutPerspective, CutSale } from '../../interfaces/cash-cut.models';
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

  readonly expanded = signal(false);

  readonly registeredLabel = computed(() =>
    this.perspective() === 'seller' ? this.texts.registeredByAdmin : this.texts.registeredByYou,
  );
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
