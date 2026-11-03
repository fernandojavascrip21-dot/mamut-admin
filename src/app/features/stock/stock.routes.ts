import { Routes } from '@angular/router';

// Rutas de la feature stock, montadas en /admin/stock por admin.routes.ts.
export const STOCK_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/stock-page/stock-page.component').then((m) => m.StockPageComponent),
    data: { title: 'Stock general' },
  },
];
