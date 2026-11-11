import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { initialsOf } from '@shared/utils/initials';
import { RESTOCK_CLOSED_LABEL } from '../../constants/restock.constants';
import type { RestockOrder } from '../../interfaces/restock.models';
import { closedOrSavedAt, formatRestockDate } from '../../rules/restock-dates.rules';
import { RESTOCK_ORDER_DETAIL_TEXTS } from './restock-order-detail.constants';
import type { RestockOrderDetailRow } from './restock-order-detail.models';

// Detalle de un pedido cerrado, solo de lectura: encabezado con fechas, nota y la tabla de renglones.
// No multiplica nada: los costos y el total son los guardados. Las filas de catálogo y los escritos a
// mano van en una sola lista; un escrito a mano lleva la etiqueta y, sin costo, «Sin costo».
@Component({
  imports: [CurrencyPipe],
  selector: 'app-restock-order-detail',
  templateUrl: './restock-order-detail.component.html',
})
export class RestockOrderDetailComponent {
  readonly order = input.required<RestockOrder>();
  readonly texts = RESTOCK_ORDER_DETAIL_TEXTS;
  readonly closedPrefix = RESTOCK_CLOSED_LABEL;

  // Fechas en la hora de la bodega (America/Mexico_City), como en la lista.
  readonly createdLabel = computed(() => formatRestockDate(this.order().createdAt));
  readonly closedLabel = computed(() => formatRestockDate(closedOrSavedAt(this.order())));

  // Imágenes que no cargaron: se pintan las iniciales en su lugar.
  private readonly brokenImages = signal<ReadonlySet<string>>(new Set());

  readonly rows = computed<RestockOrderDetailRow[]>(() => {
    const order = this.order();
    return [
      ...order.lines.map((line) => ({
        key: `catalog-${line.product.id}`,
        name: line.product.name,
        image: line.product.image,
        qty: line.qty,
        unitCost: line.unitCost,
        handwritten: false,
      })),
      ...order.customLines.map((line) => ({
        key: `custom-${line.id}`,
        name: line.name,
        image: null,
        qty: line.qty,
        unitCost: line.unitCost,
        handwritten: true,
      })),
    ];
  });

  showImage(row: RestockOrderDetailRow): boolean {
    return row.image !== null && !this.brokenImages().has(row.key);
  }

  markImageBroken(row: RestockOrderDetailRow): void {
    this.brokenImages.update((broken) => new Set(broken).add(row.key));
  }

  initials(row: RestockOrderDetailRow): string {
    return initialsOf(row.name);
  }
}
