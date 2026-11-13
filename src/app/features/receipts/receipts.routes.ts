import type { Routes } from '@angular/router';

// Rutas de la feature, montadas en /admin/remisiones. La raíz lleva a la página de pendientes.
export const RECEIPT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'pendientes' },
  {
    path: 'pendientes',
    title: 'Pendientes de remisiones',
    loadComponent: () =>
      import('./pages/receipt-pending-page/receipt-pending-page.component').then((m) => m.ReceiptPendingPageComponent),
  },
];
