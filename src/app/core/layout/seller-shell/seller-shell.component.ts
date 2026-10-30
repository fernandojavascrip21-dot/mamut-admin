import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarService } from '../services/sidebar.service';
import { TopNavComponent } from '../top-nav/top-nav.component';
import { CART, MENU } from '../constants/seller-shell.constants';

// Shell del vendedor: navbar superior + contenido de la ruta activa
// Mi stock · Vender · Carrito · Mi corte. Nunca muestra costos ni ganancia (RF-02, RNF-04).
@Component({
  imports: [RouterOutlet, TopNavComponent],
  selector: 'app-seller-shell',
  templateUrl: './seller-shell.component.html',
})
export class SellerShellComponent {
  readonly sidebar = inject(SidebarService);

  readonly menu = MENU;
  readonly cart = CART;
}
