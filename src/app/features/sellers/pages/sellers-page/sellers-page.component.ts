import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { SellerRowComponent } from '../../components/seller-row/seller-row.component';
import { SellerRowSkeletonComponent } from '../../components/seller-row-skeleton/seller-row-skeleton.component';
import type { SellerSummary } from '../../interfaces/seller.models';
import type { SellersState } from '../../models/sellers-page.models';
import { sortSellersByName } from '../../rules/seller.rules';
import { SellersService } from '../../services/sellers.service';

// «Mis vendedores» (/admin/vendedores, HU-09, pantalla 04): cada vendedor activo con sus piezas,
// en orden alfabético, más los estados cargando, vacío y error. La lista se pide al entrar; ver
// specs/M2-hu09-ver-mis-vendedores/spec.md §2 y §5.
@Component({
  imports: [RouterLink, SellerRowComponent, SellerRowSkeletonComponent],
  selector: 'app-sellers-page',
  templateUrl: './sellers-page.component.html',
})
export class SellersPageComponent {
  private readonly sellersService = inject(SellersService);

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

  // Botón «Reintentar» del estado de error: vuelve a pedir la lista sin recargar la página.
  retry(): void {
    this.sellersResource.reload();
  }
}
