import { ButtonDirective } from 'primeng/button';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ToastService } from '@core/toast/toast.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { isNotFound } from '@shared/utils/http-errors';
import { closeModalLink } from '@shared/utils/modal-links';
import { HoldingEditFormComponent } from '../../components/holding-edit-form/holding-edit-form.component';
import { HOLDING_FAILURE_TOASTS } from '../../constants/edit-holding-page.constants';
import type {
  DeliveryProduct,
  HoldingFormValue,
  HoldingResult,
  SellerHolding,
} from '../../interfaces/delivery.models';
import type { EditHoldingState, HoldingFailureNotice } from '../../models/edit-holding-page.models';
import { parseProductId } from '../../rules/delivery.rules';
import { DeliveriesService } from '../../services/deliveries.service';
import { DeliveryProductsService } from '../../services/delivery-products.service';
import { HoldingSaveService } from '../../services/holding-save.service';

// «Editar lo dejado», en un pop-up sobre el detalle del vendedor: ruta `editar/:sellerId/:productId`
// del outlet `ventana` de admin-shell. Carga el producto y lo que el vendedor ya tiene, y guarda la
// corrección (piezas, precio y costo con envío) con HoldingSaveService. Al guardar avisa con un toast,
// le dice a las páginas de atrás que el inventario cambió y se cierra.
@Component({
  imports: [ButtonDirective, ModalPanelComponent, HoldingEditFormComponent],
  selector: 'app-edit-holding-page',
  templateUrl: './edit-holding-page.component.html',
})
export class EditHoldingPageComponent {
  // --- Dependencias ---
  private readonly route = inject(ActivatedRoute);
  private readonly viewing = inject(ViewingService);
  private readonly productsService = inject(DeliveryProductsService);
  private readonly deliveriesService = inject(DeliveriesService);
  private readonly saveService = inject(HoldingSaveService);
  private readonly toastService = inject(ToastService);
  private readonly stockChanges = inject(StockChangesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // --- Parámetros de la ruta (no cambian mientras la página vive) ---
  private readonly routeParams = this.route.snapshot.paramMap;
  private readonly sellerId = this.routeParams.get('sellerId') ?? '';
  private readonly productId = parseProductId(this.routeParams.get('productId'));

  // --- Carga de datos ---
  private readonly sellers = this.viewing.sellers;
  private readonly productResource = rxResource({
    params: () => this.productId ?? undefined,
    stream: ({ params: id }) => this.productsService.get(id),
  });
  private readonly holdingResource = rxResource({
    // Solo se pide para un vendedor que la lista de la barra «Viendo» conoce: un id de la URL que no
    // es de un vendedor activo no genera una petición que sabemos que daría 404.
    params: () => {
      const known = this.sellers().some((seller) => seller.id === this.sellerId);
      return known && this.productId !== null ? this.productId : undefined;
    },
    stream: ({ params: id }) => this.deliveriesService.holding(this.sellerId, id),
  });

  readonly sellerName = computed(
    () => this.sellers().find((seller) => seller.id === this.sellerId)?.fullName ?? '',
  );
  readonly product = computed<DeliveryProduct | null>(() =>
    this.productResource.hasValue() ? this.productResource.value() : null,
  );
  readonly holding = computed<SellerHolding | null>(() =>
    this.holdingResource.hasValue() ? this.holdingResource.value() : null,
  );

  // --- Estado de la pantalla ---
  private readonly saveState = signal<'idle' | 'saving' | 'offline'>('idle');
  readonly notEnoughUnits = signal(false);
  readonly failure = signal<HoldingFailureNotice | null>(null);
  private lastValue: HoldingFormValue | null = null;

  // Primero lo que hace falta para mostrar el formulario (vendedor, producto y su stock); después el
  // guardado. Un vendedor sin ese producto (holding en 0 y sin fila) también se muestra: corregirlo
  // le daría 404 al guardar, que se avisa como «ya no está disponible».
  readonly state = computed<EditHoldingState>(() => {
    const viewingStatus = this.viewing.listStatus();
    if (viewingStatus === 'loading') return 'loading';
    if (viewingStatus === 'error') return 'error';
    if (
      this.productId === null ||
      !this.sellers().some((seller) => seller.id === this.sellerId)
    ) {
      return 'not-found';
    }
    for (const resource of [this.productResource, this.holdingResource]) {
      if (resource.status() === 'error') {
        return isNotFound(resource.error()) ? 'not-found' : 'error';
      }
    }
    if (!this.productResource.hasValue() || !this.holdingResource.hasValue()) return 'loading';
    const saving = this.saveState();
    return saving === 'idle' ? 'form' : saving;
  });
  readonly saving = computed(() => this.state() === 'saving');

  constructor() {
    // La lista de vendedores de la barra «Viendo» es la misma que usa admin-shell (load() no repite
    // la petición).
    this.viewing.load();
  }

  // X, «Cancelar» y Escape: cierra el pop-up. Mientras guarda no se puede cerrar.
  close(): void {
    if (this.saving()) return;
    void this.router.navigate(closeModalLink());
  }

  // --- Reintento de carga ---
  retryLoad(): void {
    this.viewing.reload();
    this.productResource.reload();
    this.holdingResource.reload();
  }

  // --- Guardado ---
  // Ignora un segundo envío mientras el primero sigue en curso. takeUntilDestroyed evita tocar el
  // estado si el usuario ya salió de la pantalla.
  save(value: HoldingFormValue): void {
    if (this.saveState() === 'saving' || this.productId === null) return;
    this.lastValue = value;
    this.notEnoughUnits.set(false);
    this.failure.set(null);
    this.saveState.set('saving');
    this.saveService
      .save(this.sellerId, this.productId, value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.showResult(result));
  }

  // Botón «Reintentar» del aviso sin conexión: reenvía lo mismo (es seguro: manda el total final).
  retrySave(): void {
    if (this.lastValue) this.save(this.lastValue);
  }

  private showResult(result: HoldingResult): void {
    if (result.ok) {
      this.saveState.set('idle');
      this.toastService.success(`Actualizaste lo que tiene ${this.sellerName()}`);
      this.stockChanges.notify();
      void this.router.navigate(closeModalLink());
      return;
    }
    const message =
      result.reason === 'invalid' && result.message
        ? result.message
        : HOLDING_FAILURE_TOASTS[result.reason];
    this.toastService.error(message);
    this.notEnoughUnits.set(result.reason === 'not-enough-units');
    // Un 404 o un 422 no se arreglan reintentando: quedan como aviso fijo.
    const fixedNotice = result.reason === 'not-found' || result.reason === 'invalid';
    this.failure.set(fixedNotice ? { reason: result.reason, message } : null);
    this.saveState.set(result.reason === 'offline' ? 'offline' : 'idle');
  }
}
