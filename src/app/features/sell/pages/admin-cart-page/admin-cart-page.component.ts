import { CurrencyPipe, formatCurrency, getCurrencySymbol } from '@angular/common';
import { Component, DestroyRef, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { CartService } from '@core/cart/cart.service';
import { ConfirmService } from '@core/confirm/confirm.service';
import type { SaleCatalog } from '@core/sale-catalog/sale-catalog.models';
import { SaleCatalogService } from '@core/sale-catalog/sale-catalog.service';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { unitsLabel } from '@shared/utils/units-label';
import { CartLineComponent } from '../../components/cart-line/cart-line.component';
import { SellProductCardSkeletonComponent } from '../../components/sell-product-card-skeleton/sell-product-card-skeleton.component';
import { ADMIN_CART_PAGE_TEXTS, ADMIN_PRODUCTS_URL } from '../../constants/admin-cart-page.constants';
import { ADMIN_SALE_SUMMARY_URL, REPLAYED_QUERY_PARAM } from '../../constants/sales.constants';
import type { SaleResult } from '../../interfaces/sale.models';
import type { CartConfirmError, CartPageState, CartRow } from '../../models/cart-page.models';
import {
  buildCartRows,
  buildSaleRequest,
  canIncrement,
  cartNeedsFix,
  cartProfit,
  cartTotal,
} from '../../rules/sell.rules';
import { SaleSaveService } from '../../services/sale-save.service';

// «Carrito» del administrador (/admin/carrito, HU-17): como el del vendedor, pero vende del stock del
// titular guardado con el carrito (bodega o un vendedor), nunca del de «Viendo», y muestra además la
// ganancia. Lee el catálogo de ese titular al entrar, resuelve los renglones contra él y «Confirmar
// venta» manda el carrito con su `requestId` y su `holderId`. Si queda registrada, vacía el carrito,
// avisa a «Productos» y «Stock general» y abre «Venta confirmada».
@Component({
  imports: [CurrencyPipe, RouterLink, ButtonDirective, CartLineComponent, SellProductCardSkeletonComponent],
  selector: 'app-admin-cart-page',
  providers: [SaleSaveService],
  templateUrl: './admin-cart-page.component.html',
})
export class AdminCartPageComponent {
  // 1) Dependencias
  private readonly saleCatalogService = inject(SaleCatalogService);
  protected readonly cart = inject(CartService);
  private readonly saleSave = inject(SaleSaveService);
  private readonly confirmService = inject(ConfirmService);
  private readonly stockChanges = inject(StockChangesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);

  // 2) Datos y estados. Un carrito vacío no necesita el catálogo. `params` cambia solo al pasar de vacío
  // a con renglones (el titular no cambia mientras haya renglones), así que subir o bajar piezas no
  // vuelve a pedirlo.
  private readonly hasLines = computed(() => this.cart.lines().length > 0);
  readonly catalogResource = rxResource({
    params: () => (this.hasLines() ? { holderId: this.cart.holderId() } : undefined),
    stream: ({ params }) => this.saleCatalogService.load(params.holderId),
  });
  readonly state = computed<CartPageState>(() => {
    if (!this.hasLines()) return 'empty';
    if (this.catalogResource.status() === 'error') return 'error';
    return this.catalogResource.hasValue() ? 'ready' : 'loading';
  });
  readonly catalog = computed<SaleCatalog | null>(() =>
    this.catalogResource.hasValue() ? this.catalogResource.value() : null,
  );

  // `saving` va en true antes de abrir el diálogo y hasta que la petición termina: así un segundo
  // toque no abre otro diálogo ni manda otra venta.
  readonly saving = signal(false);
  readonly confirmError = signal<CartConfirmError | null>(null);
  readonly invalidMessage = signal('');

  readonly texts = ADMIN_CART_PAGE_TEXTS;
  readonly productsUrl = ADMIN_PRODUCTS_URL;

  // 3) Titular, renglones, total y ganancia. Solo suman los renglones que alcanzan.
  readonly holderName = computed(() =>
    this.cart.holderId() === null ? this.texts.warehouse : (this.catalog()?.holder?.fullName ?? null),
  );
  readonly rows = computed(() => buildCartRows(this.catalog()?.products ?? [], this.cart.lines()));
  private readonly costById = computed(
    () => new Map((this.catalog()?.products ?? []).map((product) => [product.productId, product.unitCost])),
  );
  readonly needsFix = computed(() => cartNeedsFix(this.rows()));
  readonly piecesLabel = computed(() => unitsLabel(this.cart.totalUnits()));
  // Único `Number()` sobre un monto: solo para pasarlo al pipe `currency` al mostrarlo.
  readonly totalAmount = computed(() => Number(cartTotal(this.rows())));
  readonly profitAmount = computed(() => Number(cartProfit(this.rows(), (id) => this.costById().get(id))));

  // 4) Acciones del usuario. El tope se aplica aquí: CartService no conoce el stock.
  increment(row: CartRow): void {
    if (canIncrement(row.product, row.units)) this.cart.setUnits(row.product.productId, row.units + 1);
  }

  decrement(row: CartRow): void {
    this.cart.setUnits(row.product.productId, row.units - 1);
  }

  remove(row: CartRow): void {
    this.cart.remove(row.product.productId);
  }

  retry(): void {
    this.catalogResource.reload();
  }

  // 5) Confirmar la venta. Pide confirmación una sola vez; «Reintentar» reenvía sin volver a preguntar
  // porque el administrador ya confirmó.
  async confirm(): Promise<void> {
    if (this.saving() || this.state() !== 'ready' || this.needsFix()) return;
    this.saving.set(true);
    this.confirmError.set(null);
    const accepted = await this.confirmService.ask({
      title: this.texts.confirmDialogTitle,
      message: `${this.piecesLabel()} por ${this.formatTotal()}.`,
      confirmLabel: this.texts.confirm,
      cancelLabel: this.texts.confirmDialogCancel,
      tone: 'default',
    });
    if (!accepted) {
      this.saving.set(false);
      return;
    }
    this.send();
  }

  retrySend(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.confirmError.set(null);
    this.send();
  }

  // Manda el carrito con la llave guardada (la misma en cada reintento, aunque se recargue) y con el
  // titular del carrito: null es la bodega.
  private send(): void {
    const request = buildSaleRequest(this.cart.saleRequestId(), this.rows(), this.cart.holderId());
    if (request.lines.length === 0) {
      this.saving.set(false);
      return;
    }
    this.saleSave
      .confirm(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleResult(result, request.requestId));
  }

  // Éxito: «Venta confirmada» es el aviso, así que no hay toast. Cada fallo conserva el carrito y su
  // llave, salvo «ya registrada»: esa venta existe, así que se vacía y se abre. En ambos casos el
  // inventario cambió y se avisa a «Productos» y «Stock general».
  private handleResult(result: SaleResult, requestId: string): void {
    this.saving.set(false);
    if (result.ok) {
      this.finish(requestId);
      return;
    }
    if (result.reason === 'already-registered') {
      this.finish(requestId, true);
      return;
    }
    if (result.reason === 'invalid') this.invalidMessage.set(result.message);
    this.confirmError.set(result.reason);
    // Con el catálogo fresco, los avisos de HU-15 marcan el renglón que ya no alcanza.
    if (result.reason !== 'offline') this.catalogResource.reload();
  }

  private finish(requestId: string, replayed = false): void {
    this.cart.clear();
    this.stockChanges.notify();
    const target = [ADMIN_SALE_SUMMARY_URL, requestId];
    void (replayed
      ? this.router.navigate(target, { queryParams: { [REPLAYED_QUERY_PARAM]: 1 } })
      : this.router.navigate(target));
  }

  // Total en pesos para el diálogo; mismo formato que el pipe `currency` de la plantilla.
  private formatTotal(): string {
    return formatCurrency(this.totalAmount(), this.locale, getCurrencySymbol('MXN', 'narrow'), 'MXN');
  }
}
