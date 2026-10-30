import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopNavComponent } from '@shared/components/top-nav/top-nav.component';
import { CART, MENU } from '../constants/admin-page.constants';

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
