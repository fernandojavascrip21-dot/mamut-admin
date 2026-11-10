import type { Routes } from '@angular/router';
import { unsavedRestockGuard } from './guards/unsaved-restock.guard';

// Rutas de la feature restock, montadas en /admin/resurtir por admin.routes.ts. El guard va en la
// página (no en el montaje) para que se pregunte una sola vez al salir.
export const RESTOCK_ROUTES: Routes = [
  {
    path: '',
    canDeactivate: [unsavedRestockGuard],
    loadComponent: () => import('./pages/restock-page/restock-page.component').then((m) => m.RestockPageComponent),
    data: { title: 'Lista de resurtir' },
  },
];
