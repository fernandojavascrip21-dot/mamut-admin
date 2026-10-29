import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ProductFormComponent } from '../../products/components/product-form/product-form.component';
import { ProductSaveService } from '../../products/services/product-save.service';
import { ProductsService } from '../../products/services/products.service';
import type { Category, Product, ProductFormValue, SaveResult } from '../../products/interfaces/product.models';
import type { CreateProductState } from './create-product-page.models';

// Pantalla 03b en alta (/admin/productos/nuevo, HU-04): carga las categorías, recibe el valor
// de product-form y lo guarda con ProductSaveService. Termina en «Producto registrado», desde
// donde se puede dar de alta otro sin recargar.
@Component({
  imports: [RouterLink, ProductFormComponent],
  providers: [ProductSaveService],
  selector: 'app-create-product-page',
  templateUrl: './create-product-page.component.html',
})
export class CreateProductPageComponent {
  private readonly productsService = inject(ProductsService);
  private readonly saveService = inject(ProductSaveService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly categoriesResource = rxResource({ stream: () => this.productsService.listCategories() });
  readonly categories = computed<Category[]>(() =>
    this.categoriesResource.hasValue() ? this.categoriesResource.value() : [],
  );

  readonly state = signal<CreateProductState>('form');
  readonly nameTaken = signal(false);
  readonly categoryMissing = signal(false);
  readonly createdProduct = signal<Product | null>(null);
  private lastValue: ProductFormValue | null = null;

  // Ignora un segundo envío mientras el primero sigue en curso. takeUntilDestroyed evita tocar
  // el estado si el usuario ya salió de la pantalla.
  save(value: ProductFormValue): void {
    if (this.state() === 'saving') return;
    this.lastValue = value;
    this.nameTaken.set(false);
    this.categoryMissing.set(false);
    this.state.set('saving');
    this.saveService
      .create(value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.showResult(result));
  }

  // Botón «Reintentar» del aviso sin conexión: reenvía lo mismo; la foto ya subida no se sube otra vez.
  retry(): void {
    if (this.lastValue) this.save(this.lastValue);
  }

  // «Dar de alta otro producto»: formulario vacío y la foto recordada olvidada.
  startNewProduct(): void {
    this.lastValue = null;
    this.saveService.reset();
    this.createdProduct.set(null);
    this.state.set('form');
  }

  private showResult(result: SaveResult): void {
    if (result.ok) {
      this.createdProduct.set(result.product);
      this.state.set('created');
      return;
    }
    this.nameTaken.set(result.reason === 'duplicate-name');
    this.categoryMissing.set(result.reason === 'category-missing');
    this.state.set(result.reason === 'offline' ? 'offline' : 'form');
  }
}
