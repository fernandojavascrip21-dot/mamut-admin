import { ButtonDirective } from 'primeng/button';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ToastService } from '@core/toast/toast.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { closeModalLink, leaveModalLink } from '@shared/utils/modal-links';
import { isNotFound } from '@shared/utils/http-errors';
import { unitsLabel } from '@shared/utils/units-label';
import type { HoldingStatus } from '../../components/delivery-form/delivery-form.models';
import { DeliveryFormComponent } from '../../components/delivery-form/delivery-form.component';
import {
  CREATE_DELIVERY_EMPTY_TEXTS,
  NEW_PRODUCT_PATH,
  NEW_SELLER_PATH,
} from '../../constants/create-delivery-page.constants';
import { FAILURE_TOASTS } from '../../constants/deliveries.constants';
import type {
  DeliveryFormValue,
  DeliveryProduct,
  DeliveryProductSummary,
  DeliveryResult,
  SellerHolding,
} from '../../interfaces/delivery.models';
import type {
  CreateDeliveryState,
  DeliveryFailureNotice,
} from '../../models/create-delivery-page.models';
import { parseProductId } from '../../rules/delivery.rules';
import { DeliveriesService } from '../../services/deliveries.service';
import { DeliveryProductsService } from '../../services/delivery-products.service';
import { DeliverySaveService } from '../../services/delivery-save.service';

// «Dejar a vendedor» (pantalla 03a, HU-11), en un pop-up sobre la página actual (spec T-16): ruta
// `dejar` del outlet `ventana` de admin-shell. Carga el vendedor, el producto y lo que el vendedor ya
// tiene, y guarda la entrega con DeliverySaveService. Los parámetros matriciales de la ruta fijan el
// producto (`producto`) y el vendedor (`vendedor`). Al guardar avisa con un toast, le dice a las
// páginas de atrás que el inventario cambió y se cierra; el resumen se abre desde «Últimas entregas».
@Component({
  imports: [ButtonDirective, ModalPanelComponent, DeliveryFormComponent],
  providers: [DeliverySaveService],
  selector: 'app-create-delivery-page',
  templateUrl: './create-delivery-page.component.html',
})
export class CreateDeliveryPageComponent {
  // --- Dependencias ---
  private readonly route = inject(ActivatedRoute);
  private readonly viewing = inject(ViewingService);
  private readonly productsService = inject(DeliveryProductsService);
  private readonly deliveriesService = inject(DeliveriesService);
  private readonly saveService = inject(DeliverySaveService);
  private readonly toastService = inject(ToastService);
  private readonly stockChanges = inject(StockChangesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // --- Parámetros de la ruta (no cambian mientras la página vive) ---
  private readonly routeParams = this.route.snapshot.paramMap;
  readonly fixedSellerId = this.routeParams.get('vendedor');
  private readonly fixedProductId = parseProductId(this.routeParams.get('producto'));
  readonly fixedProduct = this.fixedProductId !== null;

  // --- Textos de los estados vacíos (plantilla) ---
  readonly emptyTexts = CREATE_DELIVERY_EMPTY_TEXTS;

  // --- Elección actual ---
  readonly sellerId = signal<string | null>(this.fixedSellerId);
  readonly productId = signal<number | null>(this.fixedProductId);

  // --- Carga de datos ---
  readonly sellers = this.viewing.sellers;

  // El buscador pide la lista de productos solo si la URL no fijó uno.
  private readonly productsResource = rxResource({
    params: () => (this.fixedProduct ? undefined : true),
    stream: () => this.productsService.list(),
  });
  private readonly productResource = rxResource({
    params: () => this.productId() ?? undefined,
    stream: ({ params: id }) => this.productsService.get(id),
  });
  private readonly holdingResource = rxResource({
    // Solo se pide para un vendedor que la lista de la barra «Viendo» conoce: un id de la URL que no
    // es de un vendedor activo no genera una petición que sabemos que daría 404.
    params: () => {
      const sellerId = this.sellerId();
      const productId = this.productId();
      const known = sellerId !== null && this.sellers().some((seller) => seller.id === sellerId);
      return known && productId !== null ? { sellerId, productId } : undefined;
    },
    stream: ({ params }) => this.deliveriesService.holding(params.sellerId, params.productId),
  });

  readonly products = computed<DeliveryProductSummary[]>(() =>
    this.productsResource.hasValue() ? this.productsResource.value() : [],
  );
  readonly product = computed<DeliveryProduct | null>(() =>
    this.productResource.hasValue() ? this.productResource.value() : null,
  );
  readonly holding = computed<SellerHolding | null>(() =>
    this.holdingResource.hasValue() ? this.holdingResource.value() : null,
  );
  readonly productLoading = computed(
    () => this.productId() !== null && this.productResource.isLoading(),
  );
  readonly holdingStatus = computed<HoldingStatus>(() => {
    if (this.sellerId() === null || this.productId() === null) return 'idle';
    if (this.holdingResource.status() === 'error') return 'error';
    return this.holdingResource.hasValue() ? 'ready' : 'loading';
  });

  // --- Estado de la pantalla ---
  private readonly saveState = signal<'idle' | 'saving' | 'offline'>('idle');
  readonly notEnoughUnits = signal(false);
  readonly failure = signal<DeliveryFailureNotice | null>(null);
  private lastValue: DeliveryFormValue | null = null;

  // Primero lo que hace falta para mostrar el formulario (vendedor y producto fijados); después los
  // estados vacíos, que solo aplican si la URL no fijó vendedor (`no-sellers`) ni producto
  // (`no-units`), y por último el guardado. Elegir otro producto con el buscador no vuelve a
  // «cargando»: solo el producto fijo de la URL bloquea la pantalla. Si faltan vendedores y piezas a
  // la vez, gana `no-sellers`.
  readonly state = computed<CreateDeliveryState>(() => {
    const viewingStatus = this.viewing.listStatus();
    if (viewingStatus === 'loading') return 'loading';
    if (viewingStatus === 'error') return 'error';
    if (
      this.fixedSellerId !== null &&
      !this.sellers().some((seller) => seller.id === this.fixedSellerId)
    ) {
      return 'not-found';
    }
    if (this.fixedProduct) {
      if (this.productResource.status() === 'error') {
        return isNotFound(this.productResource.error()) ? 'not-found' : 'error';
      }
      if (!this.productResource.hasValue()) return 'loading';
    } else {
      if (this.productsResource.status() === 'error') return 'error';
      if (!this.productsResource.hasValue()) return 'loading';
    }
    if (this.fixedSellerId === null && this.sellers().length === 0) return 'no-sellers';
    if (!this.fixedProduct && !this.products().some((product) => product.stock > 0)) {
      return 'no-units';
    }
    const saving = this.saveState();
    return saving === 'idle' ? 'form' : saving;
  });
  readonly saving = computed(() => this.state() === 'saving');

  constructor() {
    // La lista de vendedores de la barra «Viendo» es la misma que la del select (la pide
    // admin-shell; load() no repite la petición).
    this.viewing.load();
  }

  // X, «Cancelar» y Escape: cierra el pop-up. Mientras guarda no se puede cerrar.
  close(): void {
    if (this.saving()) return;
    void this.router.navigate(closeModalLink());
  }

  // --- Elección de vendedor y producto ---
  pickSeller(sellerId: string): void {
    this.sellerId.set(sellerId);
  }

  pickProduct(productId: number): void {
    this.productId.set(productId);
  }

  clearProduct(): void {
    this.productId.set(null);
  }

  // --- Estados vacíos ---
  // Cada botón principal cierra el pop-up y cambia la ruta primaria en una sola navegación
  // (`leaveModalLink`), sin pasar por la página de atrás.
  goToNewSeller(): void {
    void this.router.navigate(leaveModalLink(NEW_SELLER_PATH));
  }

  goToNewProduct(): void {
    void this.router.navigate(leaveModalLink(NEW_PRODUCT_PATH));
  }

  // --- Reintentos de carga ---
  retryLoad(): void {
    this.viewing.reload();
    this.productsResource.reload();
    this.productResource.reload();
  }

  retryHolding(): void {
    this.holdingResource.reload();
  }

  // --- Guardado ---
  // Ignora un segundo envío mientras el primero sigue en curso. takeUntilDestroyed evita tocar el
  // estado si el usuario ya salió de la pantalla.
  save(value: DeliveryFormValue): void {
    if (this.saveState() === 'saving') return;
    this.lastValue = value;
    this.notEnoughUnits.set(false);
    this.failure.set(null);
    this.saveState.set('saving');
    this.saveService
      .create(value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.showResult(result));
  }

  // Botón «Reintentar» del aviso sin conexión: reenvía lo mismo con el mismo requestId.
  retrySave(): void {
    if (this.lastValue) this.save(this.lastValue);
  }

  private showResult(result: DeliveryResult): void {
    if (result.ok) {
      const { delivery } = result;
      this.saveState.set('idle');
      this.toastService.success(
        `Le dejaste ${unitsLabel(delivery.qty)} a ${delivery.seller.fullName}`,
      );
      this.stockChanges.notify();
      void this.router.navigate(closeModalLink());
      return;
    }
    const message =
      result.reason === 'invalid' && result.message
        ? result.message
        : FAILURE_TOASTS[result.reason];
    this.toastService.error(message);
    this.notEnoughUnits.set(result.reason === 'not-enough-units');
    // Un 409 de datos distintos, un 404 o un 422 no se arreglan reintentando: quedan como aviso fijo.
    const fixedNotice =
      result.reason === 'mismatch' || result.reason === 'not-found' || result.reason === 'invalid';
    this.failure.set(fixedNotice ? { reason: result.reason, message } : null);
    this.saveState.set(result.reason === 'offline' ? 'offline' : 'idle');
  }
}
