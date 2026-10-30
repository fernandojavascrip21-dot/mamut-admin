import { Routes } from '@angular/router';

// Rutas de la feature vendedores, montadas en /admin/vendedores por admin.routes.ts.
export const SELLER_ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/sellers-page/sellers-page.component').then((m) => m.SellersPageComponent),
    data: { title: 'Vendedores' },
  },
  {
    path: 'nuevo',
    loadComponent: () =>
      import('./pages/create-seller-page/create-seller-page.component').then((m) => m.CreateSellerPageComponent),
    data: { title: 'Nuevo vendedor' },
  },
];
