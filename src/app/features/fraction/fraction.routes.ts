import { Routes } from '@angular/router';

// «Fraccionar» del administrador, montada en /admin/fraccionar por admin.routes.ts (HU-23).
export const FRACTION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/fraction-page/fraction-page.component').then((m) => m.FractionPageComponent),
    data: { title: 'Fraccionar' },
  },
];
