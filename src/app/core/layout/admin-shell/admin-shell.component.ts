import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ViewingService } from '@core/viewing/viewing.service';
import { TopNavComponent } from '../top-nav/top-nav.component';
import { ViewingBarComponent } from '../viewing-bar/viewing-bar.component';
import { CART, MENU } from '../constants/admin-shell.constants';

// Shell del administrador: navbar superior + barra «Viendo» + contenido de la ruta activa
// Stock · Productos · Carrito · Corte · Vendedores (RF-01, mockup pantalla 02 y siguientes).
// La lista de la barra se pide aquí y no en ViewingService, para que el vendedor (que usa
// seller-shell) nunca pida GET /api/sellers (HU-10).
@Component({
  imports: [RouterOutlet, TopNavComponent, ViewingBarComponent],
  selector: 'app-admin-shell',
  templateUrl: './admin-shell.component.html',
})
export class AdminShellComponent {
  readonly viewing = inject(ViewingService);

  readonly menu = MENU;
  readonly cart = CART;

  constructor() {
    this.viewing.load();
  }
}
