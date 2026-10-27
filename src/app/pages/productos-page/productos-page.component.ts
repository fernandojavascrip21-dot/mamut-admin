import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
export class ProductosPageComponent implements OnInit {
  private readonly productos = inject(ProductosService);

  readonly state = signal<ProductosState>('loading');
  readonly items = signal<ProductoResumen[]>([]);
  readonly busqueda = signal('');

  // Filtra en el cliente por subcadena del nombre, sin distinguir mayúsculas ni acentos
  // (criterio 2): la lista completa ya está en memoria, así que responde sin otra llamada.
  readonly visibles = computed(() => {
    const query = normalizarTexto(this.busqueda());
    if (query === '') return this.items();
    return this.items().filter((item) => normalizarTexto(item.name).includes(query));
  });

  ngOnInit(): void {
    this.cargar();
  }

  // Botón «Reintentar» del estado de error: vuelve a pedir la lista sin recargar la página.
  retry(): void {
    this.state.set('loading');
    this.cargar();
  }

  // Botón «Limpiar búsqueda» del estado sin resultados: vacía el buscador y vuelve a mostrar
  // todas las tarjetas (criterio 3).
  limpiarBusqueda(): void {
    this.busqueda.set('');
  }

  private cargar(): void {
    this.productos.listProductos().subscribe({
      next: (items) => {
        this.items.set(items);
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }
}
