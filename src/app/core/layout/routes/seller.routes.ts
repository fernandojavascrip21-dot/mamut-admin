import { Routes } from '@angular/router';

const comingSoon = () =>
  import('@shared/pages/coming-soon-page/coming-soon-page.component').then((m) => m.ComingSoonPageComponent);

// Hijos de /vendedor, cargados con loadChildren solo después de que roleGuard aceptó al vendedor.
export const SELLER_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'mi-stock' },
  { path: 'mi-stock', loadChildren: () => import('@features/my-stock/my-stock.routes').then((m) => m.MY_STOCK_ROUTES) },
  { path: 'vender', loadChildren: () => import('@features/sell/sell.routes').then((m) => m.SELL_ROUTES) },
  { path: 'carrito', loadChildren: () => import('@features/sell/sell.routes').then((m) => m.CART_ROUTES) },
  { path: 'venta', loadChildren: () => import('@features/sell/sell.routes').then((m) => m.SALE_ROUTES) },
  { path: 'mi-corte', loadComponent: comingSoon, data: { title: 'Mi corte' } },
];
