import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopNavComponent } from '../top-nav/top-nav.component';
import { CART, MENU } from '../constants/admin-shell.constants';

// Shell del administrador: navbar superior + contenido de la ruta activa
// Stock · Productos · Carrito · Corte · Vendedores (RF-01, mockup pantalla 02 y siguientes).
@Component({
  imports: [RouterOutlet, TopNavComponent],
  selector: 'app-admin-shell',
  templateUrl: './admin-shell.component.html',
})
export class AdminShellComponent {
  readonly menu = MENU;
  readonly cart = CART;
}
