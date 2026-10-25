import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductosService } from '../../productos/services/productos.service';
import type { ProductoResumen } from '../../productos/interfaces/producto.models';
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

  ngOnInit(): void {
    this.cargar();
  }

  // Botón «Reintentar» del estado de error: vuelve a pedir la lista sin recargar la página.
  retry(): void {
    this.state.set('loading');
    this.cargar();
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
