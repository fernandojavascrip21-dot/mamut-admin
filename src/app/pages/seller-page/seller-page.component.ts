import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopNavComponent } from '../../shared/components/top-nav/top-nav.component';
import type { CartLink, NavMenuItem } from '../../shared/components/top-nav/top-nav.models';

const MENU: NavMenuItem[] = [
  { path: 'mi-stock', label: 'Mi stock', icon: 'package' },
  { path: 'vender', label: 'Vender', icon: 'bag' },
  { path: 'mi-corte', label: 'Mi corte', icon: 'receipt' },
];

const CART: CartLink = { path: 'carrito', label: 'Carrito' };

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
