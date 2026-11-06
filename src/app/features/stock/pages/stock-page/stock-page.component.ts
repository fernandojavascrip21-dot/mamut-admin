import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { LowStockNoticeService } from '@core/low-stock-notice/low-stock-notice.service';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { deliveryModalLink, editHoldingModalLink, returnModalLink } from '@shared/utils/modal-links';
import { unitsLabel } from '@shared/utils/units-label';
import { LowStockAlertComponent } from '../../components/low-stock-alert/low-stock-alert.component';
import type { LowStockAlertItem } from '../../components/low-stock-alert/low-stock-alert.models';
import { StockProductRowSkeletonComponent } from '../../components/stock-product-row-skeleton/stock-product-row-skeleton.component';
import { StockProductRowComponent } from '../../components/stock-product-row/stock-product-row.component';
import { StockQuickActionsComponent } from '../../components/stock-quick-actions/stock-quick-actions.component';
import type { StockQuickAction } from '../../components/stock-quick-actions/stock-quick-actions.models';
import { StockSplitBarComponent } from '../../components/stock-split-bar/stock-split-bar.component';
import {
  LOW_FILTER_BADGE_MAX, LOW_STOCK_WAREHOUSE_HOLDER, NEW_PRODUCT_URL, SELLER_DELIVER_LABEL_PREFIX, SELLER_RETURN_LABEL, STOCK_PAGE_TEXTS, YO_QUICK_ACTIONS,
} from '../../constants/stock-page.constants';
import type { StockOverview } from '../../interfaces/stock-overview.models';
import type { StockPageState, StockRow } from '../../models/stock-page.models';
import {
  filterStockByName, lowStockFor, lowStockOfHolder, lowStockTitle, productBreakdown, sellerProducts, sellerTotal, splitParts,
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
    LowStockAlertComponent,
    StockProductRowComponent,
    StockProductRowSkeletonComponent,
    StockQuickActionsComponent,
    ModalPanelComponent,
  ],
  selector: 'app-stock-page',
  templateUrl: './stock-page.component.html',
})
export class StockPageComponent {
  // 1) Dependencias
  private readonly stockService = inject(StockService);
  private readonly viewing = inject(ViewingService);
  private readonly stockChanges = inject(StockChangesService);
  private readonly lowStockNotice = inject(LowStockNoticeService);
  private readonly router = inject(Router);

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
  // Pop-up «Baja existencia» (HU-18, spec §10): abierto muestra solo los productos bajos o agotados del
  // titular en «Viendo»; la lista de la pantalla no cambia.
  readonly lowOpen = signal(false);
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

  // Avisos de baja existencia (HU-18) de la vista activa. Sin avisos la tarjeta no sale.
  readonly lowStockItems = computed<LowStockAlertItem[]>(() => {
    const overview = this.overview();
    if (!overview) return [];
    return lowStockFor(overview, this.seller()?.id ?? null).map((alert) => ({
      key: `${alert.productId}-${alert.holder?.id ?? 'warehouse'}`,
      name: alert.name,
      holder: alert.holder?.fullName ?? LOW_STOCK_WAREHOUSE_HOLDER,
      units: alert.units,
      stockLevel: alert.stockLevel,
    }));
  });
  // La tarjeta sale si hay avisos y no se cerró con la X en esta sesión (HU-18, spec §10).
  readonly showLowStockCard = computed(() => this.lowStockItems().length > 0 && !this.lowStockNotice.dismissed());
  readonly lowStockCardTitle = computed(() => lowStockTitle(this.lowStockItems().length, this.seller() !== null));

  // Productos bajos o agotados del titular en «Viendo»: los del globo del botón y los del pop-up.
  readonly lowRows = computed<StockRow[]>(() => {
    const overview = this.overview();
    if (!overview) return [];
    return lowStockOfHolder(overview, this.seller()?.id ?? null).map((alert) => ({
      productId: alert.productId, name: alert.name, image: alert.image, units: alert.units, breakdown: '',
      stockLevel: alert.stockLevel,
    }));
  });
  private readonly lowCount = computed(() => this.lowRows().length);
  // Título y resumen del pop-up: «Baja existencia» o «Baja existencia de {nombre}», y «3 productos».
  readonly lowPopupTitle = computed(() => {
    const seller = this.seller();
    return seller ? `${this.texts.lowPopupSellerTitlePrefix} ${seller.fullName}` : this.texts.lowFilterLabel;
  });
  readonly lowPopupHolder = computed(() => this.seller()?.fullName ?? this.texts.lowPopupWarehouse);
  readonly lowPopupCount = computed(() => {
    const count = this.lowCount();
    return `${count} ${count === 1 ? this.texts.lowFilterAriaSingular : this.texts.lowFilterAriaPlural}`;
  });
  readonly lowPopupEmptyHint = computed(() =>
    this.seller() ? this.texts.lowPopupEmptySeller : this.texts.lowPopupEmptyWarehouse,
  );
  readonly lowBadge = computed(() => {
    const count = this.lowCount();
    if (count <= 0) return null;
    return count > LOW_FILTER_BADGE_MAX ? `${LOW_FILTER_BADGE_MAX}+` : String(count);
  });
  // Nombre accesible del botón: el globo va oculto a lectores de pantalla, así que el número va aquí.
  readonly lowFilterAriaLabel = computed(() => {
    const count = this.lowCount();
    if (count <= 0) return this.texts.lowFilterLabel;
    const noun = count === 1 ? this.texts.lowFilterAriaSingular : this.texts.lowFilterAriaPlural;
    return `${this.texts.lowFilterLabel}, ${count} ${noun}`;
  });

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

  // Botón «Baja existencia»: recibe el foco cuando se cierra la tarjeta, para que no caiga en `body`.
  private readonly lowButton = viewChild<ElementRef<HTMLButtonElement>>('lowButton');

  // 5) Acciones del usuario
  // Con un vendedor en «Viendo», tocar una fila abre el pop-up para corregir lo que tiene de ese producto.
  editSellerProduct(productId: number): void {
    const seller = this.seller();
    if (seller) void this.router.navigate(editHoldingModalLink(seller.id, productId));
  }

  retry(): void {
    this.stockResource.reload();
  }

  // «Baja existencia» (HU-18): abre y cierra el pop-up. Al cerrar, el foco regresa al botón (lo hace el
  // marco `app-modal-panel`).
  // X de la tarjeta ámbar: queda cerrada hasta el siguiente inicio de sesión y el foco pasa al botón, que
  // sigue mostrando las notificaciones de baja existencia.
  dismissLowStockCard(): void {
    this.lowStockNotice.dismiss();
    this.lowButton()?.nativeElement.focus();
  }

  openLow(): void {
    this.lowOpen.set(true);
  }

  closeLow(): void {
    this.lowOpen.set(false);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }
}
