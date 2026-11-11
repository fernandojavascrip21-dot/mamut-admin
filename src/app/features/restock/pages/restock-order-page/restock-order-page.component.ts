import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, from, map } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { ToastService } from '@core/toast/toast.service';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { closeModalLink, restockHistoryModalLink, restockModalLink } from '@shared/utils/modal-links';
import { RestockExportButtonsComponent } from '../../components/restock-export-buttons/restock-export-buttons.component';
import { RestockOrderDetailComponent } from '../../components/restock-order-detail/restock-order-detail.component';
import { RESTOCK_EXPORT_ERROR_MESSAGE } from '../../constants/restock-export.constants';
import { RESTOCK_ORDER_PAGE_TEXTS } from '../../constants/restock-order-page.constants';
import type { RestockExportFormat, RestockOrder } from '../../interfaces/restock.models';
import { buildExportDocument, restockCountsLabel } from '../../rules/restock-export.rules';
import { RestockExportService } from '../../services/restock-export.service';
import { RestockService } from '../../services/restock.service';

// Detalle de un pedido cerrado (HU-32), pop-up en el outlet `ventana`. Solo lee: exportar y «Usar como
// base» no escriben nada en el backend. Un borrador no se ve aquí: se edita en la lista de resurtir,
// así que se redirige a ella.
@Component({
  imports: [
    CurrencyPipe,
    ButtonDirective,
    Skeleton,
    ModalPanelComponent,
    RestockExportButtonsComponent,
    RestockOrderDetailComponent,
  ],
  selector: 'app-restock-order-page',
  templateUrl: './restock-order-page.component.html',
})
export class RestockOrderPageComponent {
  // --- Dependencias ---
  private readonly service = inject(RestockService);
  private readonly exporter = inject(RestockExportService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly texts = RESTOCK_ORDER_PAGE_TEXTS;

  // --- Carga del pedido ---
  // El id llega como parámetro de ruta; con toSignal se recarga si cambia sin recrear la página.
  private readonly orderId = toSignal(this.route.paramMap.pipe(map((params) => Number(params.get('id')))), {
    requireSync: true,
  });
  readonly lookup = rxResource({
    params: () => this.orderId(),
    stream: ({ params }) => this.service.getOrder(params),
  });
  readonly failed = computed(() => this.lookup.status() === 'error');
  readonly notFound = computed(() => this.lookup.hasValue() && !this.lookup.value().found);
  readonly order = computed<RestockOrder | null>(() => {
    if (!this.lookup.hasValue()) return null;
    const lookup = this.lookup.value();
    return lookup.found && lookup.order.status === 'closed' ? lookup.order : null;
  });
  readonly countsLabel = computed(() => {
    const order = this.order();
    return order ? restockCountsLabel(order.lineCount, order.totalUnits) : '';
  });

  // Un borrador se edita en la lista de resurtir: si el id es de un borrador, se pasa a esa ventana.
  private readonly redirectDraft = effect(() => {
    if (!this.lookup.hasValue()) return;
    const lookup = this.lookup.value();
    if (lookup.found && lookup.order.status === 'draft') void this.router.navigate(restockModalLink());
  });

  // --- Exportar ---
  // Formato en generación; mientras hay uno, ningún botón baja otro archivo.
  readonly busyFormat = signal<RestockExportFormat | null>(null);

  // Exporta lo guardado (el pedido del backend), nunca lo que haya en pantalla.
  exportOrder(format: RestockExportFormat): void {
    const order = this.order();
    if (!order || this.busyFormat() !== null) return;
    this.busyFormat.set(format);
    from(this.exporter.download(buildExportDocument(order), format))
      .pipe(
        finalize(() => this.busyFormat.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: () => this.toast.error(RESTOCK_EXPORT_ERROR_MESSAGE),
      });
  }

  // --- Navegación ---
  retry(): void {
    this.lookup.reload();
  }

  // «Usar como base»: abre la lista de resurtir con el parámetro `base`, que ella carga.
  useAsBase(): void {
    const order = this.order();
    if (!order) return;
    void this.router.navigate(restockModalLink({ baseId: order.id }));
  }

  backToHistory(): void {
    void this.router.navigate(restockHistoryModalLink());
  }

  close(): void {
    void this.router.navigate(closeModalLink());
  }
}
