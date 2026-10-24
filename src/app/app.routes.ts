import { Routes } from '@angular/router';
import { AccountComponent } from './features/account.component';
import { ComingSoonComponent } from './features/coming-soon.component';
import { LoginComponent } from './features/login.component';
import { AdminShellComponent } from './layouts/admin-shell.component';
import { VendedorShellComponent } from './layouts/vendedor-shell.component';
import { roleGuard } from './core/auth/role.guard';

// Árbol de rutas de M0. /admin y /vendedor están protegidas por roleGuard con su rol en
// `data.roles`; sus hijos (hoy todos ComingSoonComponent) heredan esa protección sin repetir
// el guard, porque canMatch ya decidió si esta rama del árbol se llega a matchear o no.
// /cuenta usa el mismo guard sin `roles`: exige sesión, pero de cualquiera de los dos roles.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'cuenta', component: AccountComponent, canMatch: [roleGuard] },
  {
    path: 'admin',
    component: AdminShellComponent,
    canMatch: [roleGuard],
    data: { roles: ['admin'] },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'stock' },
      { path: 'stock', component: ComingSoonComponent, data: { title: 'Stock' } },
      { path: 'productos', component: ComingSoonComponent, data: { title: 'Productos' } },
      { path: 'carrito', component: ComingSoonComponent, data: { title: 'Carrito' } },
      { path: 'corte', component: ComingSoonComponent, data: { title: 'Corte' } },
      { path: 'vendedores', component: ComingSoonComponent, data: { title: 'Vendedores' } },
    ],
  },
  {
    path: 'vendedor',
    component: VendedorShellComponent,
    canMatch: [roleGuard],
    data: { roles: ['vendedor'] },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'mi-stock' },
      { path: 'mi-stock', component: ComingSoonComponent, data: { title: 'Mi stock' } },
      { path: 'vender', component: ComingSoonComponent, data: { title: 'Vender' } },
      { path: 'carrito', component: ComingSoonComponent, data: { title: 'Carrito' } },
      { path: 'mi-corte', component: ComingSoonComponent, data: { title: 'Mi corte' } },
    ],
  },
  // Cualquier URL desconocida cae al login (no estaba en el spec, pero sin esto una ruta mal
  // escrita deja al usuario viendo una pantalla en blanco).
  { path: '**', redirectTo: 'login' },
];
