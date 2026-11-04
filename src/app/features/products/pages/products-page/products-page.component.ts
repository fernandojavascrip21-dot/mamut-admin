import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { UNKNOWN_HOLDER_NAME, WAREHOUSE_HOLDER_NAME } from '@core/cart/cart.constants';
import { CartService } from '@core/cart/cart.service';
import { clearCartConfirmOptions } from '@core/cart/clear-cart-confirm';
import { ConfirmService } from '@core/confirm/confirm.service';
import { SaleCatalogService } from '@core/sale-catalog/sale-catalog.service';
import type { SaleCatalog, SaleCatalogProduct } from '@core/sale-catalog/sale-catalog.models';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { CartBarComponent } from '@shared/components/cart-bar/cart-bar.component';
import { ProductsService } from '../../services/products.service';
import type { ProductSummary } from '../../interfaces/product.models';
import { cartTotalOf, filterProductsByName } from '../../rules/product.rules';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { ProductCardSkeletonComponent } from '../../components/product-card-skeleton/product-card-skeleton.component';
import { ADMIN_CART_URL } from '../../constants/products.constants';
import type { ProductsState } from '../../models/products-page.models';

// Pantalla «Productos» (03): una tarjeta por producto activo, con los estados cargando, error
// y catálogo vacío. La lista completa se pide una sola vez al entrar (o con «Reintentar»): ver
// specs/M1-hu05-ver-y-buscar-productos/spec.md §2 y §5. Desde HU-17 cada tarjeta ofrece «Vender» con el
// stock del titular de «Viendo»: el tope y el precio salen de su catálogo (GET /api/sales/catalog), no
// de `products.stock`, y la barra del carrito aparece abajo cuando hay piezas de ese titular.
@Component({
  imports: [RouterLink, ButtonDirective, InputText, CartBarComponent, ProductCardComponent, ProductCardSkeletonComponent],
  selector: 'app-products-page',
  templateUrl: './products-page.component.html',
})
export class ProductsPageComponent {
  private readonly productsService = inject(ProductsService);
  // Con un vendedor en «Viendo» (HU-10), «Dejar a vendedor» lo lleva ya elegido.
  readonly viewing = inject(ViewingService);
  private readonly stockChanges = inject(StockChangesService);
  private readonly saleCatalogService = inject(SaleCatalogService);
  private readonly cart = inject(CartService);
  private readonly confirm = inject(ConfirmService);

  // La lista se pide al entrar; «Reintentar» es productsResource.reload(). El estado de la
  // pantalla se deriva del status del recurso; volver a pedirla con la lista ya en pantalla (tras
  // dejar piezas, spec T-16) no cuenta como cargando, para que no parpadee detrás del pop-up.
  readonly productsResource = rxResource({ stream: () => this.productsService.listProducts() });
  readonly state = computed<ProductsState>(() => {
    const status = this.productsResource.status();
    if (status === 'error') return 'error';
    return this.productsResource.hasValue() ? 'ready' : 'loading';
  });
  readonly items = computed<ProductSummary[]>(() =>
    this.productsResource.hasValue() ? this.productsResource.value() : [],
  );
  readonly searchQuery = signal('');

  // Catálogo de venta del titular de «Viendo». No se pide mientras la lista de vendedores carga: la
  // selección guardada aún no se confirma y se vendería de la bodega por error. Cambiar de «Viendo»
  // lo vuelve a pedir y mientras llega no hay «Vender»; si falla, simplemente no hay «Vender».
  readonly catalogResource = rxResource({
    params: () => (this.viewing.listStatus() === 'loading' ? undefined : { holderId: this.viewing.selectedSellerId() }),
    stream: ({ params }) => this.saleCatalogService.load(params.holderId),
  });
  readonly catalog = computed<SaleCatalog | null>(() =>
    this.catalogResource.hasValue() ? this.catalogResource.value() : null,
  );
  private readonly catalogById = computed(
    () => new Map<number, SaleCatalogProduct>((this.catalog()?.products ?? []).map((p) => [p.productId, p])),
  );

  // Primer nombre del vendedor en «Viendo» para la línea «Luis: N»; null con «Yo · bodega».
  readonly holderLabel = computed(() => this.viewing.selectedSeller()?.fullName.split(' ')[0] ?? null);
  // El carrito es del titular de «Viendo» (o está vacío): solo entonces sus piezas se pintan en las tarjetas
  // y su total se puede calcular con este catálogo.
  private readonly cartIsHere = computed(
    () => this.cart.lines().length === 0 || this.cart.holderId() === this.viewing.selectedSellerId(),
  );
  readonly cartUnits = computed(() => (this.cartIsHere() ? this.cart.totalUnits() : 0));
  readonly cartTotal = computed(() => cartTotalOf(this.catalog()?.products ?? [], this.cart.lines()));
  readonly cartUrl = ADMIN_CART_URL;

  constructor() {
    // Dejar piezas desde el pop-up cambia la bodega: se vuelve a pedir la lista. Se ignora la versión
    // con la que nació la página, para no pedirla dos veces al entrar.
    const initial = this.stockChanges.version();
    effect(() => {
      if (this.stockChanges.version() === initial) return;
      untracked(() => {
        this.productsResource.reload();
        this.catalogResource.reload();
      });
    });
  }

  // Filtra en el cliente (criterio 2): la lista completa ya está en memoria, así que responde
  // sin otra llamada. La regla de comparación vive en product.rules.ts.
  readonly visibleItems = computed(() => filterProductsByName(this.items(), this.searchQuery()));

  // Botón «Reintentar» del estado de error: vuelve a pedir la lista sin recargar la página.
  retry(): void {
    this.productsResource.reload();
  }

  // Botón «Limpiar búsqueda» del estado sin resultados: vacía el buscador y vuelve a mostrar
  // todas las tarjetas (criterio 3).
  clearSearch(): void {
    this.searchQuery.set('');
  }

  // Piezas del titular de «Viendo» de un producto; null si no hay catálogo o no lo tiene.
  sellUnitsOf(productId: number): number | null {
    return this.catalogById().get(productId)?.units ?? null;
  }

  // Piezas del producto en el carrito, solo si el carrito es de este titular.
  unitsInCartOf(productId: number): number {
    return this.cartIsHere() ? this.cart.unitsOf(productId) : 0;
  }

  // Primer «Vender» de un producto: agrega 1 pieza. Si el carrito tiene renglones de otro titular se
  // pregunta antes de vaciarlo; cancelar no agrega nada. Con el carrito vacío se le asigna el titular
  // de «Viendo» (el que dio el catálogo), así lo que se confirma es del stock con que se armó.
  async sellAdd(productId: number): Promise<void> {
    const product = this.catalogById().get(productId);
    if (!product || product.units <= 0) return;
    const holderId = this.catalog()?.holder?.id ?? null;
    if (this.cart.lines().length > 0 && this.cart.holderId() !== holderId) {
      const accepted = await this.confirm.ask(
        clearCartConfirmOptions(this.holderName(this.cart.holderId()), this.holderName(holderId)),
      );
      if (!accepted) return;
      this.cart.clear();
    }
    this.cart.assignHolder(holderId);
    this.cart.setUnits(productId, 1);
  }

  // «+»: sube una pieza sin pasar de las del titular.
  sellIncrement(productId: number): void {
    const product = this.catalogById().get(productId);
    const units = this.cart.unitsOf(productId);
    if (product && units < product.units) this.cart.setUnits(productId, units + 1);
  }

  // «−»: baja una pieza; con 1 quita el producto.
  sellDecrement(productId: number): void {
    this.cart.setUnits(productId, this.cart.unitsOf(productId) - 1);
  }

  private holderName(holderId: string | null): string {
    if (holderId === null) return WAREHOUSE_HOLDER_NAME;
    return this.viewing.sellers().find((seller) => seller.id === holderId)?.fullName ?? UNKNOWN_HOLDER_NAME;
  }
}
