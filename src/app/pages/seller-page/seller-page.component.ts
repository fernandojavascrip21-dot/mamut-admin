import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopNavComponent } from '@shared/components/top-nav/top-nav.component';
import { CART, MENU } from './seller-page.constants';

// Página del vendedor: navbar superior + contenido de la ruta activa
// Mi stock · Vender · Carrito · Mi corte. Nunca muestra costos ni ganancia (RF-02, RNF-04).
@Component({
  imports: [RouterOutlet, TopNavComponent],
  selector: 'app-seller-page',
  templateUrl: './seller-page.component.html',
})
export class SellerPageComponent {
  readonly menu = MENU;
  readonly cart = CART;
}
