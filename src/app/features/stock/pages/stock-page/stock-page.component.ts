import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { DataView } from 'primeng/dataview';
import { InputText } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';
import { LowStockNoticeService } from '@core/low-stock-notice/low-stock-notice.service';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { FractionHistoryLineComponent } from '@shared/components/fraction-history-line/fraction-history-line.component';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { ShrinkageHistoryLineComponent } from '@shared/components/shrinkage-history-line/shrinkage-history-line.component';
import { deliveryModalLink, editHoldingModalLink, returnModalLink, shrinkageModalLink } from '@shared/utils/modal-links';
import { unitsLabel } from '@shared/utils/units-label';
import { LowStockAlertComponent } from '../../components/low-stock-alert/low-stock-alert.component';
import type { LowStockAlertItem } from '../../components/low-stock-alert/low-stock-alert.models';
import { StockProductRowSkeletonComponent } from '../../components/stock-product-row-skeleton/stock-product-row-skeleton.component';
import { StockProductRowComponent } from '../../components/stock-product-row/stock-product-row.component';
import { StockQuickActionsComponent } from '../../components/stock-quick-actions/stock-quick-actions.component';
import type { StockQuickAction } from '../../components/stock-quick-actions/stock-quick-actions.models';
import { StockSplitBarComponent } from '../../components/stock-split-bar/stock-split-bar.component';
import {
  LOW_FILTER_BADGE_MAX, LOW_STOCK_WAREHOUSE_HOLDER, NEW_PRODUCT_URL, SELLER_DELIVER_LABEL_PREFIX, SELLER_RETURN_LABEL, SELLER_SHRINKAGE_LABEL, STOCK_HISTORY_TEXTS, STOCK_PAGE_TEXTS, STOCK_PORTION_TEXTS, STOCK_VIEW_LABEL, STOCK_VIEW_OPTIONS, STOCK_VIEW_QUERY, YO_QUICK_ACTIONS,
} from '../../constants/stock-page.constants';
import type { StockOverview } from '../../interfaces/stock-overview.models';
import type { StockView } from '../../interfaces/stock-history.models';
import type { StockPageState, StockRow, StockViewOption } from '../../models/stock-page.models';
import {
  filterStockByName, lowStockFor, lowStockOfHolder, lowStockTitle, portionRows, productBreakdown, sellerProducts, sellerTotal, splitParts,
} from '../../rules/stock.rules';
import {
  filterFractionHistory, filterShrinkageHistory, historyStateOf, stockViewFromQuery,
} from '../../rules/stock-history.rules';
import { StockHistoryService } from '../../services/stock-history.service';
import { StockService } from '../../services/stock.service';

// «Stock general» (/admin/stock, HU-13): con «Yo · bodega» en la barra «Viendo», el total del negocio
// repartido entre bodega y vendedores y el reparto por producto; con un vendedor, solo su stock. Una
// sola petición trae a todos, así que cambiar de vendedor en la barra no vuelve a pedir datos.
// Desde HU-26 (§12) la misma pantalla muestra también las mermas y los fraccionados, elegidos con el
// selector y guardados en el query param `vista`.
@Component({
  imports: [
    RouterLink,
    ButtonDirective,
    DataView,
    FormsModule,
    InputText,
    SelectButton,
    Skeleton,
    StockSplitBarComponent,
    LowStockAlertComponent,
    StockProductRowComponent,
    StockProductRowSkeletonComponent,
    StockQuickActionsComponent,
    ModalPanelComponent,
    ShrinkageHistoryLineComponent,
    FractionHistoryLineComponent,
  ],
  selector: 'app-stock-page',
  templateUrl: './stock-page.component.html',
})
export class StockPageComponent {
  // 1) Dependencias
  private readonly stockService = inject(StockService);
  private readonly history = inject(StockHistoryService);
  private readonly viewing = inject(ViewingService);
  private readonly stockChanges = inject(StockChangesService);
  private readonly lowStockNotice = inject(LowStockNoticeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

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

  // Mientras la barra no confirma al vendedor guardado (cargando su lista, o ya no es activo) vale
  // null y se ve la vista de «Yo» (HU-10, selección efectiva).
  readonly seller = this.viewing.selectedSeller;

  // 3) Vista activa (HU-26 §12). Sale del query param `vista`. «Fraccionados» se ofrece también con un
  // vendedor en «Viendo» (HU-26 §13): ahí muestra solo sus bolsitas, sin el historial.
  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });
  readonly view = computed<StockView>(() => stockViewFromQuery(this.queryParams().get('vista')));
  readonly viewOptions: StockViewOption[] = STOCK_VIEW_OPTIONS;
  readonly viewLabel = STOCK_VIEW_LABEL;

  // Mermas y fraccionados se piden solo cuando su vista está activa. Un recurso sin parámetros queda
  // inactivo y no pide nada; al cambiar «Viendo» con «Mermas» abierta, cambia el parámetro y vuelve a pedir.
  readonly shrinkagesResource = rxResource({
    params: () => (this.view() === 'shrinkages' ? { sellerId: this.seller()?.id ?? null } : undefined),
    stream: ({ params }) => this.history.shrinkages(params.sellerId ?? undefined),
  });
  // Con un vendedor en «Viendo» la vista no muestra el historial (HU-26 §13), así que no se pide.
  readonly fractionsResource = rxResource({
    params: () => (this.view() === 'fractions' && this.seller() === null ? true : undefined),
    stream: () => this.history.fractions(),
  });
  readonly shrinkagesState = computed(() => historyStateOf(this.shrinkagesResource.status()));
  readonly fractionsState = computed(() => historyStateOf(this.fractionsResource.status()));
  readonly shrinkages = computed(() => this.shrinkagesResource.value() ?? []);
  readonly fractions = computed(() => this.fractionsResource.value() ?? []);
  // Con un vendedor en «Viendo» el titular ya es conocido: no se repite en cada fila.
  readonly showHolder = computed(() => this.seller() === null);
  // Con un vendedor en «Viendo» el vacío nombra a ese vendedor: «Luis no tiene mermas».
  readonly shrinkagesEmptyMessage = computed(() => {
    const seller = this.seller();
    return seller
      ? `${seller.fullName} ${this.historyTexts.shrinkagesEmptySellerSuffix}`
      : this.historyTexts.shrinkagesEmpty;
  });

  // 4) Buscador: uno solo para la vista activa. El texto de la búsqueda se conserva al cambiar de vista.
  readonly searchQuery = signal('');
  readonly visibleShrinkages = computed(() => filterShrinkageHistory(this.shrinkages(), this.searchQuery()));
  readonly visibleFractions = computed(() => filterFractionHistory(this.fractions(), this.searchQuery()));
  readonly visibleBagRows = computed(() => filterStockByName(this.bagRows(), this.searchQuery()));
  readonly searchLabel = computed(() => {
    const view = this.view();
    if (view === 'shrinkages') return STOCK_HISTORY_TEXTS.shrinkagesSearchLabel;
    if (view === 'fractions') return STOCK_HISTORY_TEXTS.fractionsSearchLabel;
    return this.texts.searchLabel;
  });
  readonly showSearch = computed(() => {
    const view = this.view();
    if (view === 'shrinkages') return this.shrinkagesState() === 'ready' && this.shrinkages().length > 0;
    if (view === 'fractions') {
      // Las bolsitas se buscan siempre; el historial solo con «Yo» y cuando ya llegó con filas.
      return this.hasBagRows() || (this.seller() === null && this.fractionsState() === 'ready' && this.fractions().length > 0);
    }
    return this.hasRows();
  });

  readonly texts = STOCK_PAGE_TEXTS;
  readonly historyTexts = STOCK_HISTORY_TEXTS;
  readonly portionTexts = STOCK_PORTION_TEXTS;
  readonly newProductUrl = NEW_PRODUCT_URL;
  // Pop-up «Baja existencia» (HU-18, spec §10): abierto muestra solo los productos bajos o agotados del
  // titular en «Viendo»; la lista de la pantalla no cambia.
  readonly lowOpen = signal(false);

  // 5) Vista de «Yo»
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
        parentProductId: product.parentProductId,
      }));
    }
    return overview.products.map((product) => ({
      productId: product.productId,
      name: product.name,
      image: product.image,
      units: product.total,
      breakdown: productBreakdown(product, overview.sellers),
      parentProductId: product.parentProductId,
    }));
  });
  readonly hasRows = computed(() => this.allRows().length > 0);
  readonly visibleRows = computed(() => filterStockByName(this.allRows(), this.searchQuery()));

  // «Bolsitas en stock» (HU-26 §13): las mismas filas que «Productos», solo las bolsitas, con el reparto
  // por titular. Con un vendedor, sus bolsitas con sus piezas.
  readonly bagRows = computed<StockRow[]>(() => portionRows(this.allRows()));
  readonly hasBagRows = computed(() => this.bagRows().length > 0);
  // Vacío de la sección: con «Yo» dice que no hay bolsitas; con un vendedor, que él no tiene.
  readonly bagsEmptyMessage = computed(() => {
    const seller = this.seller();
    return seller
      ? `${seller.fullName} ${this.portionTexts.emptySellerSuffix}`
      : this.portionTexts.emptyBusiness;
  });

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

  // 6) Vista de un vendedor
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
      { label: SELLER_SHRINKAGE_LABEL, link: shrinkageModalLink({ sellerId: seller.id }), icon: 'shrinkage' },
    ];
  });

  constructor() {
    // Dejar o retirar piezas desde el pop-up cambia el stock: se vuelve a pedir. Se ignora la versión
    // con la que nació la página, para no pedirlo dos veces al entrar. Las mermas y los fraccionados
    // también cambian con cada movimiento; un recurso inactivo no pide nada al recargarse.
    const initial = this.stockChanges.version();
    effect(() => {
      if (this.stockChanges.version() === initial) return;
      untracked(() => {
        this.stockResource.reload();
        this.shrinkagesResource.reload();
        this.fractionsResource.reload();
      });
    });
  }

  // Botón «Baja existencia»: recibe el foco cuando se cierra la tarjeta, para que no caiga en `body`.
  private readonly lowButton = viewChild<ElementRef<HTMLButtonElement>>('lowButton');

  // 7) Acciones del usuario
  // Elegir una vista la guarda en `vista` sin dejar entrada en el historial del navegador.
  selectView(view: StockView): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { vista: STOCK_VIEW_QUERY[view] },
      replaceUrl: true,
    });
  }

  // Con un vendedor en «Viendo», tocar una fila abre el pop-up para corregir lo que tiene de ese producto.
  editSellerProduct(productId: number): void {
    const seller = this.seller();
    if (seller) void this.router.navigate(editHoldingModalLink(seller.id, productId));
  }

  retry(): void {
    this.stockResource.reload();
  }

  retryShrinkages(): void {
    this.shrinkagesResource.reload();
  }

  retryFractions(): void {
    this.fractionsResource.reload();
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
