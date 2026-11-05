import { formatCurrency, getCurrencySymbol } from '@angular/common';
import { Component, DestroyRef, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { CartService } from '@core/cart/cart.service';
import { ConfirmService } from '@core/confirm/confirm.service';
import { unitsLabel } from '@shared/utils/units-label';
import { CartViewComponent } from '../../components/cart-view/cart-view.component';
import { CART_PAGE_TEXTS, SELL_URL } from '../../constants/cart-page.constants';
import { REPLAYED_QUERY_PARAM, SALE_SUMMARY_URL } from '../../constants/sales.constants';
import type { SaleResult } from '../../interfaces/sale.models';
import type { SellStock } from '../../interfaces/sell-stock.models';
import type { CartConfirmError, CartPageState, CartRow } from '../../models/cart-page.models';
import { buildCartRows, buildSaleRequest, canIncrement, cartNeedsFix, cartTotal } from '../../rules/sell.rules';
import { SaleSaveService } from '../../services/sale-save.service';
import { SellStockService } from '../../services/sell-stock.service';

// «Carrito» (/vendedor/carrito, HU-15): un renglón por producto con sus piezas, precio y subtotal, y el
// total de la venta. Las piezas y el precio se leen frescos del stock al entrar: el carrito guardado
// solo tiene `productId` y piezas, y si el stock cambió el renglón avisa (de más o agotado) sin
// ajustarse solo. «Confirmar venta» (HU-16) pide confirmación, manda el carrito con su `requestId`
// guardado y, si queda registrada, vacía el carrito y abre «Venta confirmada».
@Component({
  imports: [CartViewComponent],
  selector: 'app-cart-page',
  providers: [SaleSaveService],
  templateUrl: './cart-page.component.html',
})
export class CartPageComponent {
  // 1) Dependencias
  private readonly sellStockService = inject(SellStockService);
  protected readonly cart = inject(CartService);
  private readonly saleSave = inject(SaleSaveService);
  private readonly confirmService = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);

  // 2) Datos y estados. Un carrito vacío no necesita el stock: no se pide (`params` indefinido).
  // `hasLines` solo cambia al pasar de vacío a con renglones, así que subir o bajar piezas no vuelve
  // a pedir el stock.
  private readonly hasLines = computed(() => this.cart.lines().length > 0);
  readonly stockResource = rxResource({
    params: () => (this.hasLines() ? true : undefined),
    stream: () => this.sellStockService.load(),
  });
  readonly state = computed<CartPageState>(() => {
    if (!this.hasLines()) return 'empty';
    if (this.stockResource.status() === 'error') return 'error';
    return this.stockResource.hasValue() ? 'ready' : 'loading';
  });
  readonly stock = computed<SellStock | null>(() =>
    this.stockResource.hasValue() ? this.stockResource.value() : null,
  );

  // `saving` va en true antes de abrir el diálogo y hasta que la petición termina: así un segundo
  // toque no abre otro diálogo ni manda otra venta.
  readonly saving = signal(false);
  readonly confirmError = signal<CartConfirmError | null>(null);
  readonly invalidMessage = signal('');

  readonly texts = CART_PAGE_TEXTS;
  readonly sellUrl = SELL_URL;

  // 3) Renglones y total. El total solo suma los renglones que alcanzan.
  readonly rows = computed(() => buildCartRows(this.stock()?.products ?? [], this.cart.lines()));
  readonly needsFix = computed(() => cartNeedsFix(this.rows()));
  readonly piecesLabel = computed(() => unitsLabel(this.cart.totalUnits()));
  // Único `Number()` sobre un monto: solo para pasarlo al pipe `currency` al mostrarlo.
  readonly totalAmount = computed(() => Number(cartTotal(this.rows())));

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
    this.stockResource.reload();
  }

  // 5) Confirmar la venta (HU-16). Pide confirmación una sola vez; «Reintentar» reenvía sin volver a
  // preguntar porque el vendedor ya confirmó.
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

  // Manda el carrito con la llave guardada: la misma en cada reintento, aunque se recargue la página.
  private send(): void {
    const request = buildSaleRequest(this.cart.saleRequestId(), this.rows());
    if (request.lines.length === 0) {
      this.saving.set(false);
      return;
    }
    this.saleSave
      .confirm(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleResult(result, request.requestId));
  }

  // Éxito: la pantalla «Venta confirmada» es el aviso, así que no hay toast. Cada fallo conserva el
  // carrito y su llave, salvo «ya registrada»: esa venta existe, así que se vacía y se abre.
  private handleResult(result: SaleResult, requestId: string): void {
    this.saving.set(false);
    if (result.ok) {
      this.cart.clear();
      void this.router.navigate([SALE_SUMMARY_URL, requestId]);
      return;
    }
    if (result.reason === 'already-registered') {
      this.cart.clear();
      void this.router.navigate([SALE_SUMMARY_URL, requestId], { queryParams: { [REPLAYED_QUERY_PARAM]: 1 } });
      return;
    }
    if (result.reason === 'invalid') this.invalidMessage.set(result.message);
    this.confirmError.set(result.reason);
    // Con el stock fresco, los avisos de HU-15 marcan el renglón que ya no alcanza.
    if (result.reason !== 'offline') this.stockResource.reload();
  }

  // Total en pesos para el diálogo; mismo formato que el pipe `currency` de la plantilla.
  private formatTotal(): string {
    return formatCurrency(this.totalAmount(), this.locale, getCurrencySymbol('MXN', 'narrow'), 'MXN');
  }
}
