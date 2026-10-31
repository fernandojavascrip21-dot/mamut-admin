import { Component, computed, effect, inject } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ViewingService } from '@core/viewing/viewing.service';
import { PhonePipe } from '@shared/pipes/phone.pipe';
import { initialsOf } from '@shared/utils/initials';
import { isNotFound } from '@shared/utils/http-errors';
import { unitsLabel } from '@shared/utils/units-label';
import { DeliveryHistoryLineComponent } from '../../components/delivery-history-line/delivery-history-line.component';
import { SellerStockLineComponent } from '../../components/seller-stock-line/seller-stock-line.component';
import { DELIVERY_NEW_URL, SELLERS_LIST_URL } from '../../constants/sellers.constants';
import type { DeliveryHistoryItem, SellerDetail } from '../../interfaces/seller.models';
import type { DeliveryHistoryState, SellerDetailState } from '../../models/seller-detail-page.models';
import { SellersService } from '../../services/sellers.service';

// Detalle de un vendedor (/admin/vendedores/:id, HU-09): sus datos, su total y su stock por
// producto con los precios que le aplican (HU-11), el botón «Dejar producto» y «Últimas
// entregas». «Retirar» se agrega aquí en HU-12. Sigue a la barra «Viendo» (HU-10): abrir el detalle elige a ese vendedor, y elegir a otro en la barra
// abre el suyo (o la lista, con «Yo · bodega»).
@Component({
  imports: [RouterLink, PhonePipe, SellerStockLineComponent, DeliveryHistoryLineComponent],
  selector: 'app-seller-detail-page',
  templateUrl: './seller-detail-page.component.html',
})
export class SellerDetailPageComponent {
  private readonly sellersService = inject(SellersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly viewing = inject(ViewingService);

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
    return this.sellerResource.hasValue() && status !== 'reloading' ? 'ready' : 'loading';
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
  readonly deliveryNewUrl = DELIVERY_NEW_URL;

  readonly initials = computed(() => initialsOf(this.seller()?.fullName ?? ''));
  readonly units = computed(() => unitsLabel(this.seller()?.units ?? 0));

  constructor() {
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
}
