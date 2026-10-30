import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PhonePipe } from '@shared/pipes/phone.pipe';
import { initialsOf } from '@shared/utils/initials';
import { isNotFound } from '@shared/utils/http-errors';
import { SellerStockLineComponent } from '../../components/seller-stock-line/seller-stock-line.component';
import type { SellerDetail } from '../../interfaces/seller.models';
import type { SellerDetailState } from '../../models/seller-detail-page.models';
import { unitsLabel } from '../../rules/seller.rules';
import { SellersService } from '../../services/sellers.service';

// Detalle de un vendedor (/admin/vendedores/:id, HU-09): sus datos, su total y su stock por
// producto, en solo lectura. «Dejar» y «Retirar» se agregan aquí en HU-11 y HU-12.
@Component({
  imports: [RouterLink, PhonePipe, SellerStockLineComponent],
  selector: 'app-seller-detail-page',
  templateUrl: './seller-detail-page.component.html',
})
export class SellerDetailPageComponent {
  private readonly sellersService = inject(SellersService);
  private readonly route = inject(ActivatedRoute);

  // El backend valida el id (un id que no es UUID da 404, igual que uno inexistente).
  private readonly sellerId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly sellerResource = rxResource({
    params: () => this.sellerId,
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
  readonly initials = computed(() => initialsOf(this.seller()?.fullName ?? ''));
  readonly units = computed(() => unitsLabel(this.seller()?.units ?? 0));

  // Botón «Reintentar» del error de carga: vuelve a pedir al vendedor.
  retry(): void {
    this.sellerResource.reload();
  }
}
