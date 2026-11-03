import { Routes } from '@angular/router';

const comingSoon = () =>
  import('@shared/pages/coming-soon-page/coming-soon-page.component').then((m) => m.ComingSoonPageComponent);

// Hijos de /vendedor, cargados con loadChildren solo después de que roleGuard aceptó al vendedor.
export const SELLER_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'mi-stock' },
  { path: 'mi-stock', loadChildren: () => import('@features/my-stock/my-stock.routes').then((m) => m.MY_STOCK_ROUTES) },
  { path: 'vender', loadComponent: comingSoon, data: { title: 'Vender' } },
  { path: 'carrito', loadComponent: comingSoon, data: { title: 'Carrito' } },
  { path: 'mi-corte', loadComponent: comingSoon, data: { title: 'Mi corte' } },
];
