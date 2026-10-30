import { Routes } from '@angular/router';

const comingSoon = () =>
  import('@shared/pages/coming-soon-page/coming-soon-page.component').then((m) => m.ComingSoonPageComponent);

// Hijos de /admin, cargados con loadChildren: este archivo (y cada feature) solo se descarga
// cuando roleGuard ya dejó pasar a un administrador, así que el vendedor nunca lo baja.
// Cada feature declara sus propias rutas; aquí solo se montan en su URL.
export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'stock' },
  { path: 'stock', loadComponent: comingSoon, data: { title: 'Stock' } },
  {
    path: 'productos',
    loadChildren: () => import('@features/products/products.routes').then((m) => m.PRODUCT_ROUTES),
  },
  { path: 'carrito', loadComponent: comingSoon, data: { title: 'Carrito' } },
  { path: 'corte', loadComponent: comingSoon, data: { title: 'Corte' } },
  {
    path: 'vendedores',
    loadChildren: () => import('@features/sellers/sellers.routes').then((m) => m.SELLER_ADMIN_ROUTES),
  },
];
