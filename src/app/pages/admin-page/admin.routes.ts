import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '@products/guards/unsaved-changes.guard';

const comingSoon = () =>
  import('../coming-soon-page/coming-soon-page.component').then((m) => m.ComingSoonPageComponent);

// Hijos de /admin, cargados con loadChildren: este archivo (y cada página) solo se descarga
// cuando roleGuard ya dejó pasar a un administrador, así que el vendedor nunca lo baja.
export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'stock' },
  { path: 'stock', loadComponent: comingSoon, data: { title: 'Stock' } },
  {
    path: 'productos',
    loadComponent: () =>
      import('../products-page/products-page.component').then((m) => m.ProductsPageComponent),
    data: { title: 'Productos' },
  },
  {
    path: 'productos/nuevo',
    loadComponent: () =>
      import('../create-product-page/create-product-page.component').then((m) => m.CreateProductPageComponent),
    data: { title: 'Nuevo producto' },
  },
  {
    path: 'productos/:id/editar',
    loadComponent: () =>
      import('../edit-product-page/edit-product-page.component').then((m) => m.EditProductPageComponent),
    canDeactivate: [unsavedChangesGuard],
    data: { title: 'Editar producto' },
  },
  { path: 'carrito', loadComponent: comingSoon, data: { title: 'Carrito' } },
  { path: 'corte', loadComponent: comingSoon, data: { title: 'Corte' } },
  { path: 'vendedores', loadComponent: comingSoon, data: { title: 'Vendedores' } },
];
