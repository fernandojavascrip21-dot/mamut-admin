import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductosService } from '../../productos/services/productos.service';
import type { ProductoResumen } from '../../productos/interfaces/producto.models';

// Pantalla «Productos» mínima para HU-04: solo nombre, categoría y piezas, más el botón +
// que lleva al alta (03b). El diseño completo de la pantalla 03 (cards, Vender, Dejar a
// vendedor) queda para otra historia — ver specs/M1-hu04-dar-de-alta-producto/spec.md §1.
@Component({
  imports: [RouterLink],
  selector: 'app-productos-page',
  templateUrl: './productos-page.component.html',
})
export class ProductosPageComponent implements OnInit {
  private readonly productos = inject(ProductosService);

  readonly items = signal<ProductoResumen[]>([]);
  readonly loading = signal(true);

  private readonly categoriasPorId = signal<Map<number, string>>(new Map());

  ngOnInit(): void {
    this.productos.listCategorias().subscribe((categorias) => {
      this.categoriasPorId.set(new Map(categorias.map((c) => [c.id, c.name])));
    });
    this.productos.listProductos().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  categoriaDe(categoryId: number | null): string {
    if (categoryId === null) return 'Sin categoría';
    return this.categoriasPorId().get(categoryId) ?? 'Sin categoría';
  }
}
