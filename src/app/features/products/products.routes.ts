import { Routes } from '@angular/router';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

// Rutas de la feature productos, montadas en /admin/productos por admin.routes.ts.
export const PRODUCT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/products-page/products-page.component').then((m) => m.ProductsPageComponent),
    data: { title: 'Productos' },
  },
  {
    path: 'nuevo',
    loadComponent: () =>
      import('./pages/create-product-page/create-product-page.component').then((m) => m.CreateProductPageComponent),
    data: { title: 'Nuevo producto' },
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./pages/edit-product-page/edit-product-page.component').then((m) => m.EditProductPageComponent),
    canDeactivate: [unsavedChangesGuard],
    data: { title: 'Editar producto' },
  },
];
