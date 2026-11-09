import { Routes } from '@angular/router';

// Historial de mermas (HU-26), montado en /admin/mermas por admin.routes.ts.
export const SHRINKAGE_HISTORY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/shrinkage-history-page/shrinkage-history-page.component').then(
        (m) => m.ShrinkageHistoryPageComponent,
      ),
  },
];
