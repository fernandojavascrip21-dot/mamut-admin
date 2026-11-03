import { Routes } from '@angular/router';

// Rutas de la feature my-stock, montadas en /vendedor/mi-stock por seller.routes.ts.
export const MY_STOCK_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/my-stock-page/my-stock-page.component').then((m) => m.MyStockPageComponent),
    data: { title: 'Mi stock' },
  },
];
