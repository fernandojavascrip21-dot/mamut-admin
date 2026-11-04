import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { CartService } from '@core/cart/cart.service';
import { unitsLabel } from '@shared/utils/units-label';
import { CartLineComponent } from '../../components/cart-line/cart-line.component';
import { SellProductCardSkeletonComponent } from '../../components/sell-product-card-skeleton/sell-product-card-skeleton.component';
import { CART_PAGE_TEXTS, SELL_URL } from '../../constants/cart-page.constants';
import type { SellStock } from '../../interfaces/sell-stock.models';
import type { CartPageState, CartRow } from '../../models/cart-page.models';
import { buildCartRows, canIncrement, cartNeedsFix, cartTotal } from '../../rules/sell.rules';
import { SellStockService } from '../../services/sell-stock.service';

// «Carrito» (/vendedor/carrito, HU-15): un renglón por producto con sus piezas, precio y subtotal, y el
// total de la venta. Las piezas y el precio se leen frescos del stock al entrar: el carrito guardado
// solo tiene `productId` y piezas, y si el stock cambió el renglón avisa (de más o agotado) sin
// ajustarse solo. Confirmar la venta es HU-16.
@Component({
  imports: [CurrencyPipe, RouterLink, ButtonDirective, CartLineComponent, SellProductCardSkeletonComponent],
  selector: 'app-cart-page',
  templateUrl: './cart-page.component.html',
})
export class CartPageComponent {
  // 1) Dependencias
  private readonly sellStockService = inject(SellStockService);
  protected readonly cart = inject(CartService);

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
}
