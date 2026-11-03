import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { deliveryModalLink, returnModalLink } from '@shared/utils/modal-links';
import { unitsLabel } from '@shared/utils/units-label';
import { StockProductRowSkeletonComponent } from '../../components/stock-product-row-skeleton/stock-product-row-skeleton.component';
import { StockProductRowComponent } from '../../components/stock-product-row/stock-product-row.component';
import { StockQuickActionsComponent } from '../../components/stock-quick-actions/stock-quick-actions.component';
import type { StockQuickAction } from '../../components/stock-quick-actions/stock-quick-actions.models';
import { StockSplitBarComponent } from '../../components/stock-split-bar/stock-split-bar.component';
import {
  NEW_PRODUCT_URL, SELLER_DELIVER_LABEL_PREFIX, SELLER_RETURN_LABEL, STOCK_PAGE_TEXTS, YO_QUICK_ACTIONS,
} from '../../constants/stock-page.constants';
import type { StockOverview } from '../../interfaces/stock-overview.models';
import type { StockPageState, StockRow } from '../../models/stock-page.models';
import {
  filterStockByName, productBreakdown, sellerProducts, sellerTotal, splitParts,
} from '../../rules/stock.rules';
import { StockService } from '../../services/stock.service';

// «Stock general» (/admin/stock, HU-13): con «Yo · bodega» en la barra «Viendo», el total del negocio
// repartido entre bodega y vendedores y el reparto por producto; con un vendedor, solo su stock. Una
// sola petición trae a todos, así que cambiar de vendedor en la barra no vuelve a pedir datos.
@Component({
  imports: [
    RouterLink,
    ButtonDirective,
    InputText,
    StockSplitBarComponent,
    StockProductRowComponent,
    StockProductRowSkeletonComponent,
    StockQuickActionsComponent,
  ],
  selector: 'app-stock-page',
  templateUrl: './stock-page.component.html',
})
export class StockPageComponent {
  // 1) Dependencias
  private readonly stockService = inject(StockService);
  private readonly viewing = inject(ViewingService);
  private readonly stockChanges = inject(StockChangesService);

  // 2) Datos y estados. El estado se deriva del recurso; volver a pedir el stock con datos en
  // pantalla (tras «Dejar» o «Retirar») no cuenta como cargando, para que no parpadee detrás del pop-up.
  readonly stockResource = rxResource({ stream: () => this.stockService.overview() });
  readonly state = computed<StockPageState>(() => {
    if (this.stockResource.status() === 'error') return 'error';
    return this.stockResource.hasValue() ? 'ready' : 'loading';
  });
  readonly overview = computed<StockOverview | null>(() =>
    this.stockResource.hasValue() ? this.stockResource.value() : null,
  );
  readonly isEmpty = computed(() => (this.overview()?.products.length ?? 0) === 0);

  readonly searchQuery = signal('');
  readonly texts = STOCK_PAGE_TEXTS;
  readonly newProductUrl = NEW_PRODUCT_URL;

  // Mientras la barra no confirma al vendedor guardado (cargando su lista, o ya no es activo) vale
  // null y se ve la vista de «Yo» (HU-10, selección efectiva).
  readonly seller = this.viewing.selectedSeller;

  // 3) Vista de «Yo»
  readonly splitParts = computed(() => {
    const overview = this.overview();
    return overview ? splitParts(overview) : [];
  });
  readonly totalLabel = computed(() => unitsLabel(this.overview()?.total ?? 0));

  // Todas las filas de la vista activa, sin buscador. El total y la barra salen del recurso, así
  // que filtrar la lista no los cambia.
  private readonly allRows = computed<StockRow[]>(() => {
    const overview = this.overview();
    if (!overview) return [];
    const seller = this.seller();
    if (seller) {
      return sellerProducts(overview, seller.id).map(({ product, units }) => ({
        productId: product.productId, name: product.name, image: product.image, units, breakdown: '',
      }));
    }
    return overview.products.map((product) => ({
      productId: product.productId,
      name: product.name,
      image: product.image,
      units: product.total,
      breakdown: productBreakdown(product, overview.sellers),
    }));
  });
  readonly hasRows = computed(() => this.allRows().length > 0);
  readonly visibleRows = computed(() => filterStockByName(this.allRows(), this.searchQuery()));

  // 4) Vista de un vendedor
  readonly sellerTotalLabel = computed(() => {
    const overview = this.overview();
    const seller = this.seller();
    return unitsLabel(overview && seller ? sellerTotal(overview, seller.id) : 0);
  });

  // Movimientos rápidos de la vista activa; la página arma los enlaces y el componente solo los pinta.
  readonly quickActions = computed<StockQuickAction[]>(() => {
    const seller = this.seller();
    if (!seller) return YO_QUICK_ACTIONS;
    return [
      {
        label: `${SELLER_DELIVER_LABEL_PREFIX} ${seller.fullName}`,
        link: deliveryModalLink({ sellerId: seller.id }),
        icon: 'deliver',
      },
      { label: SELLER_RETURN_LABEL, link: returnModalLink(seller.id), icon: 'return' },
    ];
  });

  constructor() {
    // Dejar o retirar piezas desde el pop-up cambia el stock: se vuelve a pedir. Se ignora la versión
    // con la que nació la página, para no pedirlo dos veces al entrar.
    const initial = this.stockChanges.version();
    effect(() => {
      if (this.stockChanges.version() !== initial) untracked(() => this.stockResource.reload());
    });
  }

  // 5) Acciones del usuario
  retry(): void {
    this.stockResource.reload();
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }
}
