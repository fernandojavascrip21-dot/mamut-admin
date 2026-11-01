import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { ProductsService } from '../../services/products.service';
import type { ProductSummary } from '../../interfaces/product.models';
import { filterProductsByName } from '../../rules/product.rules';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { ProductCardSkeletonComponent } from '../../components/product-card-skeleton/product-card-skeleton.component';
import type { ProductsState } from '../../models/products-page.models';

// Pantalla «Productos» (03): una tarjeta por producto activo, con los estados cargando, error
// y catálogo vacío. La lista completa se pide una sola vez al entrar (o con «Reintentar»): ver
// specs/M1-hu05-ver-y-buscar-productos/spec.md §2 y §5.
@Component({
  imports: [RouterLink, ProductCardComponent, ProductCardSkeletonComponent],
  selector: 'app-products-page',
  templateUrl: './products-page.component.html',
})
export class ProductsPageComponent {
  private readonly productsService = inject(ProductsService);
  // Con un vendedor en «Viendo» (HU-10), «Dejar a vendedor» lo lleva ya elegido.
  readonly viewing = inject(ViewingService);
  private readonly stockChanges = inject(StockChangesService);

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

  constructor() {
    // Dejar piezas desde el pop-up cambia la bodega: se vuelve a pedir la lista. Se ignora la versión
    // con la que nació la página, para no pedirla dos veces al entrar.
    const initial = this.stockChanges.version();
    effect(() => {
      if (this.stockChanges.version() !== initial) untracked(() => this.productsResource.reload());
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
}
