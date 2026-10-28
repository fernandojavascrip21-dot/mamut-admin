import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ProductosService } from '../../productos/services/productos.service';
import type { ProductoResumen } from '../../productos/interfaces/producto.models';
import { normalizarTexto } from '../../shared/normalizar-texto';
import { ProductoCardComponent } from './ui/producto-card/producto-card.component';
import { ProductoCardSkeletonComponent } from './ui/producto-card-skeleton/producto-card-skeleton.component';

type ProductosState = 'loading' | 'error' | 'ready';

// Pantalla «Productos» (03): una tarjeta por producto activo, con los estados cargando, error
// y catálogo vacío. La lista completa se pide una sola vez al entrar (o con «Reintentar»): ver
// specs/M1-hu05-ver-y-buscar-productos/spec.md §2 y §5.
@Component({
  imports: [RouterLink, ProductoCardComponent, ProductoCardSkeletonComponent],
  selector: 'app-productos-page',
  templateUrl: './productos-page.component.html',
})
export class ProductosPageComponent {
  private readonly productos = inject(ProductosService);

  // La lista se pide al entrar; «Reintentar» es productsResource.reload(). El estado de la
  // pantalla se deriva del status del recurso (reloading cuenta como cargando).
  readonly productsResource = rxResource({ stream: () => this.productos.listProductos() });
  readonly state = computed<ProductosState>(() => {
    const status = this.productsResource.status();
    if (status === 'error') return 'error';
    return this.productsResource.hasValue() && status !== 'reloading' ? 'ready' : 'loading';
  });
  readonly items = computed<ProductoResumen[]>(() =>
    this.productsResource.hasValue() ? this.productsResource.value() : [],
  );
  readonly busqueda = signal('');

  // Filtra en el cliente por subcadena del nombre, sin distinguir mayúsculas ni acentos
  // (criterio 2): la lista completa ya está en memoria, así que responde sin otra llamada.
  readonly visibles = computed(() => {
    const query = normalizarTexto(this.busqueda());
    if (query === '') return this.items();
    return this.items().filter((item) => normalizarTexto(item.name).includes(query));
  });

  // Botón «Reintentar» del estado de error: vuelve a pedir la lista sin recargar la página.
  retry(): void {
    this.productsResource.reload();
  }

  // Botón «Limpiar búsqueda» del estado sin resultados: vacía el buscador y vuelve a mostrar
  // todas las tarjetas (criterio 3).
  limpiarBusqueda(): void {
    this.busqueda.set('');
  }
}
