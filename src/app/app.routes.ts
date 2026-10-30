import { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/guards/role.guard';
import { guestGuard } from '@core/auth/guards/guest.guard';

// Árbol de rutas, todo con carga diferida. /admin y /vendedor están protegidas por roleGuard
// con su rol en `data.roles`; sus hijos (admin.routes.ts, seller.routes.ts) heredan esa
// protección sin repetir el guard, y como canMatch decide antes de cargar, el código de una
// rama nunca se descarga para el otro rol.
// /cuenta usa el mismo guard sin `roles`: exige sesión, pero de cualquiera de los dos roles.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  // guestGuard cierra el criterio 5 de HU-03: con sesión activa, reabrir /login no muestra
  // el formulario, redirige directo a la home del rol.
  {
    path: 'login',
    loadComponent: () => import('@features/auth/pages/login-page/login-page.component').then((m) => m.LoginPageComponent),
    canMatch: [guestGuard],
  },
  {
    path: 'cuenta',
    loadComponent: () =>
      import('@features/account/pages/account-page/account-page.component').then((m) => m.AccountPageComponent),
    canMatch: [roleGuard],
  },
  {
    path: 'admin',
    loadComponent: () => import('@core/layout/admin-shell/admin-shell.component').then((m) => m.AdminShellComponent),
    canMatch: [roleGuard],
    data: { roles: ['admin'] },
    loadChildren: () => import('@core/layout/routes/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'vendedor',
    loadComponent: () =>
      import('@core/layout/seller-shell/seller-shell.component').then((m) => m.SellerShellComponent),
    canMatch: [roleGuard],
    data: { roles: ['vendedor'] },
    loadChildren: () => import('@core/layout/routes/seller.routes').then((m) => m.SELLER_ROUTES),
  },
  // Cualquier URL desconocida cae al login (no estaba en el spec, pero sin esto una ruta mal
  // escrita deja al usuario viendo una pantalla en blanco).
  { path: '**', redirectTo: 'login' },
];
