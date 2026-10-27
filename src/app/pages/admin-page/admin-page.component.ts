import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopNavComponent } from '../../shared/components/top-nav/top-nav.component';
import type { CartLink, NavMenuItem } from '../../shared/components/top-nav/top-nav.models';

const MENU: NavMenuItem[] = [
  { path: 'stock', label: 'Stock', icon: 'package' },
  { path: 'productos', label: 'Productos', icon: 'tag' },
  { path: 'corte', label: 'Corte', icon: 'receipt' },
  { path: 'vendedores', label: 'Vendedores', icon: 'users' },
];

const CART: CartLink = { path: 'carrito', label: 'Carrito' };

// Página del administrador: navbar superior + contenido de la ruta activa
// Stock · Productos · Carrito · Corte · Vendedores (RF-01, mockup pantalla 02 y siguientes).
@Component({
  imports: [RouterOutlet, TopNavComponent],
  selector: 'app-admin-page',
  templateUrl: './admin-page.component.html',
})
export class AdminPageComponent {
  readonly menu = MENU;
  readonly cart = CART;
}
