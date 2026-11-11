import { CurrencyPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { restockOrderModalLink } from '@shared/utils/modal-links';
import type { RestockHistoryItemView } from '../../models/restock-history-page.models';
import { RESTOCK_HISTORY_ITEM_TEXTS } from './restock-history-item.constants';

// Un renglón de «Pedidos anteriores». Es un enlace al detalle del pedido; las fechas, conteos y el
// total llegan ya calculados (el total es el del backend, sin sumar nada aquí).
@Component({
  imports: [CurrencyPipe, RouterLink],
  selector: 'app-restock-history-item',
  templateUrl: './restock-history-item.component.html',
})
export class RestockHistoryItemComponent {
  readonly item = input.required<RestockHistoryItemView>();
  readonly texts = RESTOCK_HISTORY_ITEM_TEXTS;
  readonly link = computed(() => restockOrderModalLink(this.item().id));
}
