import { Routes } from '@angular/router';

// «Corte» del administrador, montada en /admin/corte por admin.routes.ts (HU-19).
export const ADMIN_CASH_CUT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/admin-cash-cut-page/admin-cash-cut-page.component').then(
        (m) => m.AdminCashCutPageComponent,
      ),
    data: { title: 'Corte' },
  },
];
