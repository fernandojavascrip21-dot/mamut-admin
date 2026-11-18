import { ButtonDirective } from 'primeng/button';
import { Component, computed, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { SelectButton } from 'primeng/selectbutton';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ViewingService } from '@core/viewing/viewing.service';
import { SellerRowComponent } from '../../components/seller-row/seller-row.component';
import { SellerRowSkeletonComponent } from '../../components/seller-row-skeleton/seller-row-skeleton.component';
import {
  SELLERS_FILTER_LABEL, SELLERS_FILTER_OPTIONS, SELLERS_INACTIVE_EMPTY_HINT, SELLERS_INACTIVE_EMPTY_TITLE,
} from '../../constants/sellers-page.constants';
import {
  SELLERS_FILTER_PARAM, SELLERS_INACTIVE_PARAM_VALUE, SELLERS_LIST_URL,
} from '../../constants/sellers.constants';
import type { SellerSummary } from '../../interfaces/seller.models';
import type { SellersFilter, SellersState } from '../../models/sellers-page.models';
import { sortSellersByName } from '../../rules/seller.rules';
import { SellersService } from '../../services/sellers.service';

// «Mis vendedores» (/admin/vendedores, HU-09, pantalla 04): cada vendedor activo con sus piezas,
// en orden alfabético, más los estados cargando, vacío y error. La lista se pide al entrar; ver
// specs/M2-hu09-ver-mis-vendedores/spec.md §2 y §5. Con un vendedor en la barra «Viendo» se abre
// su detalle (HU-10, como el mockup 04): la lista se ve con «Yo · bodega».
@Component({
  imports: [ButtonDirective, FormsModule, RouterLink, SelectButton, SellerRowComponent, SellerRowSkeletonComponent],
  selector: 'app-sellers-page',
  templateUrl: './sellers-page.component.html',
})
export class SellersPageComponent {
  private readonly sellersService = inject(SellersService);
  private readonly viewing = inject(ViewingService);
  private readonly router = inject(Router);

  private readonly route = inject(ActivatedRoute);

  // El filtro vive en `?estado=` (HU-44): `desactivados` muestra los desactivados y cualquier otro valor, los activos.
  readonly filter = toSignal(
    this.route.queryParamMap.pipe(
      map((params): SellersFilter => (params.get(SELLERS_FILTER_PARAM) === SELLERS_INACTIVE_PARAM_VALUE ? 'inactive' : 'active')),
    ),
    { initialValue: 'active' as SellersFilter },
  );
  readonly filterOptions = SELLERS_FILTER_OPTIONS;
  readonly filterLabel = SELLERS_FILTER_LABEL;
  readonly inactiveEmptyTitle = SELLERS_INACTIVE_EMPTY_TITLE;
  readonly inactiveEmptyHint = SELLERS_INACTIVE_EMPTY_HINT;

  // «Reintentar» es sellersResource.reload(); reloading cuenta como cargando. Cambiar el filtro pide otra lista.
  readonly sellersResource = rxResource({
    params: () => this.filter(),
    stream: ({ params: filter }) => this.sellersService.list(filter),
  });
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

  // Cambiar de filtro navega con `replaceUrl` para que «atrás» no recorra cada cambio; «Activos» quita el parámetro.
  selectFilter(filter: SellersFilter | null): void {
    if (filter === null || filter === this.filter()) return;
    const queryParams = { [SELLERS_FILTER_PARAM]: filter === 'inactive' ? SELLERS_INACTIVE_PARAM_VALUE : null };
    const tree = this.router.createUrlTree([], { relativeTo: this.route, queryParams });
    void this.router.navigateByUrl(tree, { replaceUrl: true });
  }

  // Botón «Reintentar» del estado de error: vuelve a pedir la lista sin recargar la página.
  retry(): void {
    this.sellersResource.reload();
  }
}
