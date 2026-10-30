import { Component, computed, effect, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ViewingService } from '@core/viewing/viewing.service';
import { SellerRowComponent } from '../../components/seller-row/seller-row.component';
import { SellerRowSkeletonComponent } from '../../components/seller-row-skeleton/seller-row-skeleton.component';
import { SELLERS_LIST_URL } from '../../constants/sellers.constants';
import type { SellerSummary } from '../../interfaces/seller.models';
import type { SellersState } from '../../models/sellers-page.models';
import { sortSellersByName } from '../../rules/seller.rules';
import { SellersService } from '../../services/sellers.service';

// «Mis vendedores» (/admin/vendedores, HU-09, pantalla 04): cada vendedor activo con sus piezas,
// en orden alfabético, más los estados cargando, vacío y error. La lista se pide al entrar; ver
// specs/M2-hu09-ver-mis-vendedores/spec.md §2 y §5. Con un vendedor en la barra «Viendo» se abre
// su detalle (HU-10, como el mockup 04): la lista se ve con «Yo · bodega».
@Component({
  imports: [RouterLink, SellerRowComponent, SellerRowSkeletonComponent],
  selector: 'app-sellers-page',
  templateUrl: './sellers-page.component.html',
})
export class SellersPageComponent {
  private readonly sellersService = inject(SellersService);
  private readonly viewing = inject(ViewingService);
  private readonly router = inject(Router);

  // «Reintentar» es sellersResource.reload(); reloading cuenta como cargando.
  readonly sellersResource = rxResource({ stream: () => this.sellersService.list() });
  readonly state = computed<SellersState>(() => {
    const status = this.sellersResource.status();
    if (status === 'error') return 'error';
    return this.sellersResource.hasValue() && status !== 'reloading' ? 'ready' : 'loading';
  });
  readonly sellers = computed<SellerSummary[]>(() =>
    this.sellersResource.hasValue() ? sortSellersByName(this.sellersResource.value()) : [],
  );

  constructor() {
    // Reacciona también tarde: si la barra confirma la selección guardada cuando su lista
    // termina de cargar, la página pasa al detalle en ese momento. replaceUrl para que «atrás»
    // no regrese a una lista que volvería a redirigir.
    effect(() => {
      const sellerId = this.viewing.selectedSellerId();
      if (sellerId !== null) void this.router.navigateByUrl(`${SELLERS_LIST_URL}/${sellerId}`, { replaceUrl: true });
    });
  }

  // Botón «Reintentar» del estado de error: vuelve a pedir la lista sin recargar la página.
  retry(): void {
    this.sellersResource.reload();
  }
}
