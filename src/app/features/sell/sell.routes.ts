import { Routes } from '@angular/router';

// Rutas de la feature sell, montadas en /vendedor/vender y /vendedor/carrito por seller.routes.ts.
export const SELL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/sell-page/sell-page.component').then((m) => m.SellPageComponent),
    data: { title: 'Vender' },
  },
];

export const CART_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/cart-page/cart-page.component').then((m) => m.CartPageComponent),
    data: { title: 'Carrito' },
  },
];

// «Venta confirmada», montada en /vendedor/venta por seller.routes.ts (HU-16).
export const SALE_ROUTES: Routes = [
  {
    path: ':requestId',
    loadComponent: () =>
      import('./pages/sale-summary-page/sale-summary-page.component').then((m) => m.SaleSummaryPageComponent),
    data: { title: 'Venta confirmada' },
  },
];
