import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ToastService } from '@core/toast/toast.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { isNotFound } from '@shared/utils/http-errors';
import { unitsLabel } from '@shared/utils/units-label';
import type { HoldingStatus } from '../../components/delivery-form/delivery-form.models';
import { DeliveryFormComponent } from '../../components/delivery-form/delivery-form.component';
import { DELIVERY_URL, FAILURE_TOASTS } from '../../constants/deliveries.constants';
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
import { parseProductId, parseReturnTarget, returnUrl } from '../../rules/delivery.rules';
import { DeliveriesService } from '../../services/deliveries.service';
import { DeliveryProductsService } from '../../services/delivery-products.service';
import { DeliverySaveService } from '../../services/delivery-save.service';

// «Dejar a vendedor» (pantalla 03a, /admin/entregas/nueva, HU-11): carga el vendedor, el producto
// y lo que el vendedor ya tiene, y guarda la entrega con DeliverySaveService. Los parámetros de la
// URL fijan el producto (`producto`), el vendedor (`vendedor`) y a dónde regresa (`volver`).
// Termina en el resumen de la entrega.
@Component({
  imports: [RouterLink, DeliveryFormComponent],
  providers: [DeliverySaveService],
  selector: 'app-create-delivery-page',
  templateUrl: './create-delivery-page.component.html',
})
export class CreateDeliveryPageComponent {
  // --- Dependencias ---
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly viewing = inject(ViewingService);
  private readonly productsService = inject(DeliveryProductsService);
  private readonly deliveriesService = inject(DeliveriesService);
  private readonly saveService = inject(DeliverySaveService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Parámetros de la URL (no cambian mientras la página vive) ---
  private readonly queryParams = this.route.snapshot.queryParamMap;
  readonly fixedSellerId = this.queryParams.get('vendedor');
  private readonly fixedProductId = parseProductId(this.queryParams.get('producto'));
  readonly fixedProduct = this.fixedProductId !== null;
  private readonly returnTarget = parseReturnTarget(this.queryParams.get('volver'));

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

  // Primero lo que hace falta para mostrar el formulario (vendedor y producto fijados); después el
  // guardado. Elegir otro producto con el buscador no vuelve a «cargando»: solo el producto fijo
  // de la URL bloquea la pantalla.
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
    const saving = this.saveState();
    return saving === 'idle' ? 'form' : saving;
  });
  readonly saving = computed(() => this.state() === 'saving');
  readonly cancelUrl = computed(() => returnUrl(this.returnTarget, this.sellerId()));

  constructor() {
    // La lista de vendedores de la barra «Viendo» es la misma que la del select (la pide
    // admin-shell; load() no repite la petición).
    this.viewing.load();
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
      void this.router.navigate([DELIVERY_URL, delivery.requestId], {
        queryParams: { volver: this.returnTarget },
      });
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
