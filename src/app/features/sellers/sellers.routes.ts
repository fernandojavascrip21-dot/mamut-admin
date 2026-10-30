import { Routes } from '@angular/router';

// Rutas de la feature vendedores, montadas en /admin/vendedores por admin.routes.ts.
export const SELLER_ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/sellers-page/sellers-page.component').then((m) => m.SellersPageComponent),
    data: { title: 'Mis vendedores' },
  },
  {
    path: 'nuevo',
    loadComponent: () =>
      import('./pages/create-seller-page/create-seller-page.component').then((m) => m.CreateSellerPageComponent),
    data: { title: 'Nuevo vendedor' },
  },
  // Después de `nuevo`, para que esa ruta no se lea como un id.
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/seller-detail-page/seller-detail-page.component').then((m) => m.SellerDetailPageComponent),
    data: { title: 'Vendedor' },
  },
];
