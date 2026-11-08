import { Routes } from '@angular/router';

// Historial de fraccionados (HU-24), montado en /admin/fraccionados por admin.routes.ts.
export const FRACTION_HISTORY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/fraction-history-page/fraction-history-page.component').then(
        (m) => m.FractionHistoryPageComponent,
      ),
    data: { title: 'Fraccionados' },
  },
];
