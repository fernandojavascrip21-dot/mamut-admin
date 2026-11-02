import { ButtonDirective } from 'primeng/button';
import { Component, computed, effect, inject, untracked } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { DataView } from 'primeng/dataview';
import { filter, map } from 'rxjs';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { PhonePipe } from '@shared/pipes/phone.pipe';
import { MODAL_RETURN_PATH } from '@shared/constants/modal.constants';
import { initialsOf } from '@shared/utils/initials';
import { isNotFound } from '@shared/utils/http-errors';
import { unitsLabel } from '@shared/utils/units-label';
import { deliveryModalLink, openModalPath, returnModalLink } from '@shared/utils/modal-links';
import { DeliveryHistoryLineComponent } from '../../components/delivery-history-line/delivery-history-line.component';
import { ReturnHistoryLineComponent } from '../../components/return-history-line/return-history-line.component';
import { SellerStockLineComponent } from '../../components/seller-stock-line/seller-stock-line.component';
import { SELLERS_LIST_URL } from '../../constants/sellers.constants';
import type { DeliveryHistoryItem, ReturnHistoryItem, SellerDetail } from '../../interfaces/seller.models';
import type { DeliveryHistoryState, ReturnHistoryState, SellerDetailState } from '../../models/seller-detail-page.models';
import { SellerReturnsService } from '../../services/seller-returns.service';
import { SellersService } from '../../services/sellers.service';

// Detalle de un vendedor (/admin/vendedores/:id, HU-09): sus datos, su total y su stock por
// producto con los precios que le aplican (HU-11), los botones «Dejar producto» y «Retirar
// producto» (HU-12), «Últimas entregas» y «Últimos retiros». Sigue a la barra «Viendo» (HU-10):
// abrir el detalle elige a ese vendedor, y elegir a otro en la barra abre el suyo (o la lista, con
// «Yo · bodega»).
@Component({
  imports: [ButtonDirective, 
    RouterLink,
    DataView,
    PhonePipe,
    SellerStockLineComponent,
    DeliveryHistoryLineComponent,
    ReturnHistoryLineComponent,
  ],
  selector: 'app-seller-detail-page',
  templateUrl: './seller-detail-page.component.html',
})
export class SellerDetailPageComponent {
  private readonly sellersService = inject(SellersService);
  private readonly returnsService = inject(SellerReturnsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly viewing = inject(ViewingService);
  private readonly stockChanges = inject(StockChangesService);

  // El backend valida el id (un id que no es UUID da 404, igual que uno inexistente). Se lee
  // de paramMap y no del snapshot porque, al elegir a otro vendedor en la barra, el router
  // reusa esta misma página con otro :id.
  private readonly sellerId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });

  readonly sellerResource = rxResource({
    params: () => this.sellerId(),
    stream: ({ params: id }) => this.sellersService.get(id),
  });
  readonly state = computed<SellerDetailState>(() => {
    const status = this.sellerResource.status();
    if (status === 'error') return isNotFound(this.sellerResource.error()) ? 'not-found' : 'error';
    return this.sellerResource.hasValue() ? 'ready' : 'loading';
  });
  readonly seller = computed<SellerDetail | null>(() =>
    this.sellerResource.hasValue() ? this.sellerResource.value() : null,
  );

  // «Últimas entregas» se pide cuando el vendedor ya cargó, y una falla suya no esconde el detalle.
  readonly historyResource = rxResource({
    params: () => (this.state() === 'ready' ? this.sellerId() : undefined),
    stream: ({ params: id }) => this.sellersService.deliveries(id),
  });
  readonly historyState = computed<DeliveryHistoryState>(() => {
    if (this.historyResource.status() === 'error') return 'error';
    return this.historyResource.hasValue() ? 'ready' : 'loading';
  });
  readonly history = computed<DeliveryHistoryItem[]>(() =>
    this.historyResource.hasValue() ? this.historyResource.value() : [],
  );
  readonly deliveryLink = computed(() => deliveryModalLink({ sellerId: this.sellerId() }));
  readonly returnLink = computed(() => returnModalLink(this.sellerId()));

  // El botón naranja (principal) es el de la ventana abierta: «Retirar» mientras su ventana está
  // abierta y «Dejar» en cualquier otro caso (sin ventana o con la de «Dejar»).
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  readonly returnActive = computed(
    () => openModalPath(this.router.parseUrl(this.currentUrl())) === MODAL_RETURN_PATH,
  );
  readonly deliverySeverity = computed(() => (this.returnActive() ? 'secondary' : null));
  readonly returnSeverity = computed(() => (this.returnActive() ? null : 'secondary'));

  // «Últimos retiros» (HU-12) se carga igual que las entregas, aparte y sin esconder el detalle.
  readonly returnsResource = rxResource({
    params: () => (this.state() === 'ready' ? this.sellerId() : undefined),
    stream: ({ params: id }) => this.returnsService.list(id),
  });
  readonly returnsState = computed<ReturnHistoryState>(() => {
    if (this.returnsResource.status() === 'error') return 'error';
    return this.returnsResource.hasValue() ? 'ready' : 'loading';
  });
  readonly returns = computed<ReturnHistoryItem[]>(() =>
    this.returnsResource.hasValue() ? this.returnsResource.value() : [],
  );

  readonly initials = computed(() => initialsOf(this.seller()?.fullName ?? ''));
  readonly units = computed(() => unitsLabel(this.seller()?.units ?? 0));
  // Sin piezas no hay nada que retirar: el botón «Retirar producto» no se muestra.
  readonly canReturn = computed(() => (this.seller()?.units ?? 0) > 0);
  readonly sellersListUrl = SELLERS_LIST_URL;

  constructor() {
    // Dejar o retirar piezas desde el pop-up (spec T-16) cambia el stock y los dos historiales: se
    // vuelven a pedir sin pasar por «cargando», para que el detalle no parpadee detrás del pop-up. Se
    // ignora la versión con la que nació la página, para no pedir todo dos veces al entrar.
    const initial = this.stockChanges.version();
    effect(() => {
      if (this.stockChanges.version() === initial) return;
      untracked(() => {
        this.sellerResource.reload();
        this.historyResource.reload();
        this.returnsResource.reload();
      });
    });

    // Un detalle que cargó bien cuenta como elegir a ese vendedor; un 404 no cambia la barra.
    effect(() => {
      const seller = this.seller();
      if (this.state() === 'ready' && seller) this.viewing.select(seller.id);
    });

    // Solo lo que el administrador elige en la barra navega (no el select() de arriba), para
    // que página y barra no se persigan en bucle.
    this.viewing.picked.pipe(takeUntilDestroyed()).subscribe((sellerId) => {
      void this.router.navigateByUrl(sellerId === null ? SELLERS_LIST_URL : `${SELLERS_LIST_URL}/${sellerId}`);
    });
  }

  // Botón «Reintentar» del error de carga: vuelve a pedir al vendedor.
  retry(): void {
    this.sellerResource.reload();
  }

  // «Reintentar» de «Últimas entregas».
  retryHistory(): void {
    this.historyResource.reload();
  }

  // «Reintentar» de «Últimos retiros».
  retryReturns(): void {
    this.returnsResource.reload();
  }
}
