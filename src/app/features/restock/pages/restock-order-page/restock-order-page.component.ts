import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, catchError, finalize, from, map, of, startWith, switchMap } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { ToastService } from '@core/toast/toast.service';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { closeModalLink, restockHistoryModalLink, restockModalLink } from '@shared/utils/modal-links';
import { RestockExportButtonsComponent } from '../../components/restock-export-buttons/restock-export-buttons.component';
import { RestockOrderDetailComponent } from '../../components/restock-order-detail/restock-order-detail.component';
import { RESTOCK_EXPORT_ERROR_MESSAGE } from '../../constants/restock-export.constants';
import { RESTOCK_ORDER_PAGE_TEXTS } from '../../constants/restock-order-page.constants';
import type { RestockExportFormat, RestockOrderLookup, RestockOrder } from '../../interfaces/restock.models';
import type { RestockOrderLoad } from '../../models/restock-order-page.models';
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
  // Cada pedido de la ruta arranca una petición, y «Reintentar» emite de nuevo en `retries`. La
  // petición sale al pulsar, no durante la detección de cambios: así el reintento es una acción igual
  // que las demás (como el guardado de la lista de resurtir), y el borrador se queda en el pipeline.
  private readonly retries = new Subject<void>();
  private readonly load = toSignal(
    this.route.paramMap.pipe(
      map((params) => Number(params.get('id'))),
      switchMap((id) =>
        this.retries.pipe(
          startWith(undefined),
          switchMap(() =>
            this.service.getOrder(id).pipe(
              map((lookup): RestockOrderLoad => ({ failed: false, lookup })),
              catchError(() => of<RestockOrderLoad>({ failed: true })),
            ),
          ),
        ),
      ),
    ),
    { initialValue: null },
  );

  readonly failed = computed(() => this.load()?.failed === true);
  // Respuesta del servicio, o null mientras carga o si falló.
  private readonly lookupResult = computed<RestockOrderLookup | null>(() => {
    const load = this.load();
    return load !== null && !load.failed ? load.lookup : null;
  });
  readonly notFound = computed(() => {
    const lookup = this.lookupResult();
    return lookup !== null && !lookup.found;
  });
  readonly order = computed<RestockOrder | null>(() => {
    const lookup = this.lookupResult();
    if (lookup === null || !lookup.found) return null;
    return lookup.order.status === 'closed' ? lookup.order : null;
  });
  readonly countsLabel = computed(() => {
    const order = this.order();
    return order ? restockCountsLabel(order.lineCount, order.totalUnits) : '';
  });

  // Un borrador se edita en la lista de resurtir: si el id es de un borrador, se pasa a esa ventana.
  private readonly redirectDraft = effect(() => {
    const lookup = this.lookupResult();
    if (lookup !== null && lookup.found && lookup.order.status === 'draft') {
      void this.router.navigate(restockModalLink());
    }
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
    this.retries.next();
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
