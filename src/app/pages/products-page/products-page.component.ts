import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ProductsService } from '../../products/services/products.service';
import type { ProductSummary } from '../../products/interfaces/product.models';
import { normalizeText } from '../../shared/normalize-text';
import { ProductCardComponent } from './ui/product-card/product-card.component';
import { ProductCardSkeletonComponent } from './ui/product-card-skeleton/product-card-skeleton.component';

type ProductsState = 'loading' | 'error' | 'ready';

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

  // La lista se pide al entrar; «Reintentar» es productsResource.reload(). El estado de la
  // pantalla se deriva del status del recurso (reloading cuenta como cargando).
  readonly productsResource = rxResource({ stream: () => this.productsService.listProducts() });
  readonly state = computed<ProductsState>(() => {
    const status = this.productsResource.status();
    if (status === 'error') return 'error';
    return this.productsResource.hasValue() && status !== 'reloading' ? 'ready' : 'loading';
  });
  readonly items = computed<ProductSummary[]>(() =>
    this.productsResource.hasValue() ? this.productsResource.value() : [],
  );
  readonly searchQuery = signal('');

  // Filtra en el cliente por subcadena del nombre, sin distinguir mayúsculas ni acentos
  // (criterio 2): la lista completa ya está en memoria, así que responde sin otra llamada.
  readonly visibleItems = computed(() => {
    const query = normalizeText(this.searchQuery());
    if (query === '') return this.items();
    return this.items().filter((item) => normalizeText(item.name).includes(query));
  });

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
