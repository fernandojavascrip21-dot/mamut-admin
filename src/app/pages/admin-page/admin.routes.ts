import { Routes } from '@angular/router';
import { cambiosSinGuardarGuard } from '../../productos/guards/cambios-sin-guardar.guard';

const comingSoon = () =>
  import('../coming-soon-page/coming-soon-page.component').then((m) => m.ComingSoonPageComponent);
const nuevoProducto = () =>
  import('../nuevo-producto-page/nuevo-producto-page.component').then((m) => m.NuevoProductoPageComponent);

// Hijos de /admin, cargados con loadChildren: este archivo (y cada página) solo se descarga
// cuando roleGuard ya dejó pasar a un administrador, así que el vendedor nunca lo baja.
export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'stock' },
  { path: 'stock', loadComponent: comingSoon, data: { title: 'Stock' } },
  {
    path: 'productos',
    loadComponent: () =>
      import('../productos-page/productos-page.component').then((m) => m.ProductosPageComponent),
    data: { title: 'Productos' },
  },
  { path: 'productos/nuevo', loadComponent: nuevoProducto, data: { title: 'Nuevo producto' } },
  {
    path: 'productos/:id/editar',
    loadComponent: nuevoProducto,
    canDeactivate: [cambiosSinGuardarGuard],
    data: { title: 'Editar producto' },
  },
  { path: 'carrito', loadComponent: comingSoon, data: { title: 'Carrito' } },
  { path: 'corte', loadComponent: comingSoon, data: { title: 'Corte' } },
  { path: 'vendedores', loadComponent: comingSoon, data: { title: 'Vendedores' } },
];
