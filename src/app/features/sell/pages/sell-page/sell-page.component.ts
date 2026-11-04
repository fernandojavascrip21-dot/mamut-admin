import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { CartService } from '@core/cart/cart.service';
import { CartBarComponent } from '@shared/components/cart-bar/cart-bar.component';
import { SellProductCardSkeletonComponent } from '../../components/sell-product-card-skeleton/sell-product-card-skeleton.component';
import { SellProductCardComponent } from '../../components/sell-product-card/sell-product-card.component';
import { CART_URL, SELL_PAGE_TEXTS } from '../../constants/sell-page.constants';
import type { SellProduct, SellStock } from '../../interfaces/sell-stock.models';
import type { SellPageState } from '../../models/sell-page.models';
import { buildCartRows, canIncrement, cartTotal, filterSellProductsByName } from '../../rules/sell.rules';
import { SellStockService } from '../../services/sell-stock.service';

// «Vender» (/vendedor/vender, HU-15): el catálogo del vendedor con buscador, y por cada producto
// «+ Agregar», −/+ con tope en lo que tiene, o «Agotado». Las piezas elegidas viven en `CartService`;
// aquí solo se decide qué cambio pedirle. Pide el stock cada vez que se entra, así que un «Dejar» o
// «Retirar» del administrador ya se ve al volver. Confirmar la venta es HU-16.
@Component({
  imports: [
    ButtonDirective,
    InputText,
    CartBarComponent,
    SellProductCardComponent,
    SellProductCardSkeletonComponent,
  ],
  selector: 'app-sell-page',
  templateUrl: './sell-page.component.html',
})
export class SellPageComponent {
  // 1) Dependencias
  private readonly sellStockService = inject(SellStockService);
  protected readonly cart = inject(CartService);

  // 2) Datos y estados. Volver a pedir con datos en pantalla no cuenta como cargando.
  readonly stockResource = rxResource({ stream: () => this.sellStockService.load() });
  readonly state = computed<SellPageState>(() => {
    if (this.stockResource.status() === 'error') return 'error';
    return this.stockResource.hasValue() ? 'ready' : 'loading';
  });
  readonly stock = computed<SellStock | null>(() =>
    this.stockResource.hasValue() ? this.stockResource.value() : null,
  );
  readonly isEmpty = computed(() => (this.stock()?.products.length ?? 0) === 0);

  readonly searchQuery = signal('');
  readonly texts = SELL_PAGE_TEXTS;
  readonly cartUrl = CART_URL;

  // 3) Lista y barra del carrito. El buscador solo filtra la lista: la barra sale del carrito entero.
  readonly visibleProducts = computed(() =>
    filterSellProductsByName(this.stock()?.products ?? [], this.searchQuery()),
  );
  readonly cartUnits = this.cart.totalUnits;
  readonly cartTotal = computed(() => cartTotal(buildCartRows(this.stock()?.products ?? [], this.cart.lines())));

  // 4) Acciones del usuario. El tope se aplica aquí: CartService no conoce el stock.
  add(product: SellProduct): void {
    if (canIncrement(product, this.cart.unitsOf(product.productId))) this.cart.setUnits(product.productId, 1);
  }

  increment(product: SellProduct): void {
    const units = this.cart.unitsOf(product.productId);
    if (canIncrement(product, units)) this.cart.setUnits(product.productId, units + 1);
  }

  decrement(product: SellProduct): void {
    this.cart.setUnits(product.productId, this.cart.unitsOf(product.productId) - 1);
  }

  retry(): void {
    this.stockResource.reload();
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }
}
