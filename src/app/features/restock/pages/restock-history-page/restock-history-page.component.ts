import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Skeleton } from 'primeng/skeleton';
import { ButtonDirective } from 'primeng/button';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { closeModalLink, restockModalLink } from '@shared/utils/modal-links';
import { RestockHistoryItemComponent } from '../../components/restock-history-item/restock-history-item.component';
import {
  RESTOCK_HISTORY_PAGE_TEXTS,
  RESTOCK_HISTORY_SKELETON_ROWS,
} from '../../constants/restock-history-page.constants';
import type { RestockHistoryItemView } from '../../models/restock-history-page.models';
import { historyItemView, sortClosedOrders } from '../../rules/restock-history.rules';
import { RestockService } from '../../services/restock.service';

// «Pedidos anteriores» (HU-32), pop-up en el outlet `ventana`. Solo lee la lista de pedidos cerrados:
// no tiene guard de salida porque no hay nada que guardar. La lista llega del backend por
// `createdAt` y aquí se ordena por cierre (la regla vive en `rules/restock-history.rules.ts`).
@Component({
  imports: [Skeleton, ButtonDirective, ModalPanelComponent, RestockHistoryItemComponent],
  selector: 'app-restock-history-page',
  templateUrl: './restock-history-page.component.html',
})
export class RestockHistoryPageComponent {
  // --- Dependencias ---
  private readonly service = inject(RestockService);
  private readonly router = inject(Router);

  readonly texts = RESTOCK_HISTORY_PAGE_TEXTS;
  readonly skeletonRows = RESTOCK_HISTORY_SKELETON_ROWS;

  // --- Carga de la lista ---
  readonly data = rxResource({ stream: () => this.service.listClosed() });
  readonly failed = computed(() => this.data.status() === 'error');
  // null mientras carga: la plantilla pinta el esqueleto.
  readonly items = computed<RestockHistoryItemView[] | null>(() =>
    this.data.hasValue() ? sortClosedOrders(this.data.value()).map(historyItemView) : null,
  );

  // --- Navegación ---
  retry(): void {
    this.data.reload();
  }

  // «Volver al pedido»: la lista de resurtir, sin parámetros.
  backToOrder(): void {
    void this.router.navigate(restockModalLink());
  }

  // La X y Escape cierran todo el pop-up, como en la lista de resurtir.
  close(): void {
    void this.router.navigate(closeModalLink());
  }
}
