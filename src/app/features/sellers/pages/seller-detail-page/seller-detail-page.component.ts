import { DatePipe } from '@angular/common';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { PhonePipe } from '@shared/pipes/phone.pipe';
import { MODAL_RETURN_PATH } from '@shared/constants/modal.constants';
import { initialsOf } from '@shared/utils/initials';
import { isNotFound } from '@shared/utils/http-errors';
import { unitsLabel } from '@shared/utils/units-label';
import {
  deliveryModalLink,
  editHoldingModalLink,
  editSellerModalLink,
  openModalPath,
  returnModalLink,
} from '@shared/utils/modal-links';
import { DataGridComponent } from '@shared/components/data-grid/data-grid.component';
import type { DataGridOption, DataGridRow, DataGridState } from '@shared/components/data-grid/data-grid.models';
import { SellerChangesService } from '../../services/seller-changes.service';
import { SELLERS_LIST_URL } from '../../constants/sellers.constants';
import {
  DEFAULT_SELLER_DETAIL_VIEW,
  SELLER_DETAIL_COLUMNS,
  SELLER_DETAIL_FILTER_LABEL,
  SELLER_DETAIL_TEXTS,
  SELLER_DETAIL_VIEWS,
} from '../../constants/seller-detail-page.constants';
import {
  deliveryRows,
  returnRows,
  sellerDetailOptionLabel,
  shrinkageRows,
  stockRows,
} from '../../rules/seller-detail-grid.rules';
import type {
  DeliveryHistoryItem,
  ReturnHistoryItem,
  SellerDetail,
  ShrinkageHistoryItem,
} from '../../interfaces/seller.models';
import type {
  DeliveryHistoryState,
  ReturnHistoryState,
  SellerDetailState,
  SellerDetailView,
  ShrinkageHistoryState,
} from '../../models/seller-detail-page.models';
import { SellerReturnsService } from '../../services/seller-returns.service';
import { SellerShrinkagesService } from '../../services/seller-shrinkages.service';
import { SellersService } from '../../services/sellers.service';

// Detalle de un vendedor (/admin/vendedores/:id, HU-09): sus datos, su total y su stock por
// producto con los precios que le aplican (HU-11), los botones «Dejar producto» y «Retirar
// producto» (HU-12) y una sola tabla con filtro para su stock, sus entregas, retiros y mermas
// (HU-26). Sigue a la barra «Viendo» (HU-10): abrir el detalle elige a ese vendedor, y elegir a otro en la barra abre el suyo (o la lista, con
// «Yo · bodega»).
@Component({
  imports: [ButtonDirective, Tag, DatePipe,
    RouterLink,
    PhonePipe,
    DataGridComponent,
  ],
  selector: 'app-seller-detail-page',
  templateUrl: './seller-detail-page.component.html',
})
export class SellerDetailPageComponent {
  private readonly sellersService = inject(SellersService);
  private readonly returnsService = inject(SellerReturnsService);
  private readonly shrinkagesService = inject(SellerShrinkagesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly viewing = inject(ViewingService);
  private readonly stockChanges = inject(StockChangesService);
  private readonly sellerChanges = inject(SellerChangesService);

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
  readonly editLink = computed(() => editSellerModalLink(this.sellerId()));

  // El grid emite el valor como texto: solo se acepta una de las listas de SELLER_DETAIL_VIEWS.
  selectView(value: string): void {
    const view = SELLER_DETAIL_VIEWS.find((option) => option.value === value)?.value;
    if (view) this.view.set(view);
  }

  // Tocar una línea del stock en el grid: su `actionId` es el productId (las de movimientos no tienen).
  onRowAction(actionId: string): void {
    this.editHolding(Number(actionId));
  }

  // «Editar» de una línea del stock: abre la ventana de corrección de ese producto.
  editHolding(productId: number): void {
    void this.router.navigate(editHoldingModalLink(this.sellerId(), productId));
  }

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

  // «Últimas mermas» (HU-26) se carga igual que los retiros: aparte, y su error no esconde el detalle.
  readonly shrinkagesResource = rxResource({
    params: () => (this.state() === 'ready' ? this.sellerId() : undefined),
    stream: ({ params: id }) => this.shrinkagesService.list(id),
  });
  readonly shrinkagesState = computed<ShrinkageHistoryState>(() => {
    if (this.shrinkagesResource.status() === 'error') return 'error';
    return this.shrinkagesResource.hasValue() ? 'ready' : 'loading';
  });
  readonly shrinkages = computed<ShrinkageHistoryItem[]>(() =>
    this.shrinkagesResource.hasValue() ? this.shrinkagesResource.value() : [],
  );

  // Grid único (`app-data-grid`): el filtro elige si pinta el stock o uno de los historiales. Los historiales se cargan
  // igual que antes, así que cambiar de filtro no pide nada; cada opción lleva su conteo cuando su
  // lista ya cargó (el stock llega con el vendedor, siempre listo).
  readonly view = signal<SellerDetailView>(DEFAULT_SELLER_DETAIL_VIEW);
  readonly filterLabel = SELLER_DETAIL_FILTER_LABEL;
  private readonly viewStates = computed<Record<SellerDetailView, DataGridState>>(() => ({
    stock: 'ready',
    deliveries: this.historyState(),
    returns: this.returnsState(),
    shrinkages: this.shrinkagesState(),
  }));
  private readonly viewCounts = computed<Record<SellerDetailView, number>>(() => ({
    stock: this.seller()?.stock.length ?? 0,
    deliveries: this.history().length,
    returns: this.returns().length,
    shrinkages: this.shrinkages().length,
  }));
  readonly viewOptions = computed<DataGridOption[]>(() =>
    SELLER_DETAIL_VIEWS.map(({ value, label }) => ({
      value,
      label: sellerDetailOptionLabel(label, this.viewStates()[value] === 'ready' ? this.viewCounts()[value] : null),
    })),
  );
  readonly gridState = computed(() => this.viewStates()[this.view()]);
  readonly gridTexts = computed(() => SELLER_DETAIL_TEXTS[this.view()]);
  readonly gridColumns = computed(() => SELLER_DETAIL_COLUMNS[this.view()]);
  readonly gridRows = computed<DataGridRow[]>(() => {
    switch (this.view()) {
      case 'stock':
        return stockRows(this.seller()?.stock ?? []);
      case 'deliveries':
        return deliveryRows(this.history());
      case 'returns':
        return returnRows(this.returns(), this.sellerId());
      case 'shrinkages':
        return shrinkageRows(this.shrinkages());
    }
  });

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
        this.shrinkagesResource.reload();
      });
    });

    // Guardar «Editar datos» (HU-43) solo cambia los datos del vendedor: se vuelve a pedir sin pasar
    // por «cargando» y los historiales no se tocan. Igual que arriba, se ignora la versión inicial.
    const initialSeller = this.sellerChanges.version();
    effect(() => {
      if (this.sellerChanges.version() === initialSeller) return;
      untracked(() => this.sellerResource.reload());
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

  // «Reintentar» del grid: vuelve a pedir solo el historial que está a la vista (el stock no tiene
  // «Reintentar» propio: si falla, falla el detalle completo).
  retryGrid(): void {
    switch (this.view()) {
      case 'stock':
        return this.retry();
      case 'deliveries':
        return this.retryHistory();
      case 'returns':
        return this.retryReturns();
      case 'shrinkages':
        return this.retryShrinkages();
    }
  }

  // «Reintentar» de «Últimas entregas».
  retryHistory(): void {
    this.historyResource.reload();
  }

  // «Reintentar» de «Últimos retiros».
  retryReturns(): void {
    this.returnsResource.reload();
  }

  // «Reintentar» de «Últimas mermas».
  retryShrinkages(): void {
    this.shrinkagesResource.reload();
  }
}
