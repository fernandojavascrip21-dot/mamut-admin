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
  // Retirar producto y su resumen (HU-12): rutas de dos o más segmentos, no del menú.
  {
    path: ':id/retirar',
    loadComponent: () =>
      import('./pages/return-units-page/return-units-page.component').then((m) => m.ReturnUnitsPageComponent),
    data: { title: 'Retirar producto' },
  },
  {
    path: ':id/retiros/:requestId',
    loadComponent: () =>
      import('./pages/return-summary-page/return-summary-page.component').then((m) => m.ReturnSummaryPageComponent),
    data: { title: 'Retiro' },
  },
  // Después de `nuevo`, para que esa ruta no se lea como un id.
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/seller-detail-page/seller-detail-page.component').then((m) => m.SellerDetailPageComponent),
    data: { title: 'Vendedor' },
  },
];
