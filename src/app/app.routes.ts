import { Routes } from '@angular/router';
import { AccountPageComponent } from './pages/account-page/account-page.component';
import { ComingSoonPageComponent } from './pages/coming-soon-page/coming-soon-page.component';
import { LoginPageComponent } from './pages/login-page/login-page.component';
import { AdminPageComponent } from './pages/admin-page/admin-page.component';
import { VendedorPageComponent } from './pages/vendedor-page/vendedor-page.component';
import { roleGuard } from './auth/guards/role.guard';

// Árbol de rutas de M0. /admin y /vendedor están protegidas por roleGuard con su rol en
// `data.roles`; sus hijos (hoy todos ComingSoonPageComponent) heredan esa protección sin
// repetir el guard, porque canMatch ya decidió si esta rama del árbol se llega a matchear o no.
// /cuenta usa el mismo guard sin `roles`: exige sesión, pero de cualquiera de los dos roles.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginPageComponent },
  { path: 'cuenta', component: AccountPageComponent, canMatch: [roleGuard] },
  {
    path: 'admin',
    component: AdminPageComponent,
    canMatch: [roleGuard],
    data: { roles: ['admin'] },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'stock' },
      { path: 'stock', component: ComingSoonPageComponent, data: { title: 'Stock' } },
      { path: 'productos', component: ComingSoonPageComponent, data: { title: 'Productos' } },
      { path: 'carrito', component: ComingSoonPageComponent, data: { title: 'Carrito' } },
      { path: 'corte', component: ComingSoonPageComponent, data: { title: 'Corte' } },
      { path: 'vendedores', component: ComingSoonPageComponent, data: { title: 'Vendedores' } },
    ],
  },
  {
    path: 'vendedor',
    component: VendedorPageComponent,
    canMatch: [roleGuard],
    data: { roles: ['vendedor'] },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'mi-stock' },
      { path: 'mi-stock', component: ComingSoonPageComponent, data: { title: 'Mi stock' } },
      { path: 'vender', component: ComingSoonPageComponent, data: { title: 'Vender' } },
      { path: 'carrito', component: ComingSoonPageComponent, data: { title: 'Carrito' } },
      { path: 'mi-corte', component: ComingSoonPageComponent, data: { title: 'Mi corte' } },
    ],
  },
  // Cualquier URL desconocida cae al login (no estaba en el spec, pero sin esto una ruta mal
  // escrita deja al usuario viendo una pantalla en blanco).
  { path: '**', redirectTo: 'login' },
];
