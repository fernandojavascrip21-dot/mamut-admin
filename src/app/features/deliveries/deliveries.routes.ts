import { Routes } from '@angular/router';

// Rutas de la feature entregas, montadas en /admin/entregas por admin.routes.ts. No son del menú:
// se llega desde «Productos» y desde el detalle de un vendedor.
export const DELIVERY_ROUTES: Routes = [
  {
    path: ':requestId',
    loadComponent: () =>
      import('./pages/delivery-summary-page/delivery-summary-page.component').then(
        (m) => m.DeliverySummaryPageComponent,
      ),
    data: { title: 'Entrega' },
  },
];
