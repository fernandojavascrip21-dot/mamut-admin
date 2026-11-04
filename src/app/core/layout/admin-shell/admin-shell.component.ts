import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UNKNOWN_HOLDER_NAME, WAREHOUSE_HOLDER_NAME } from '@core/cart/cart.constants';
import { CartService } from '@core/cart/cart.service';
import { clearCartConfirmOptions } from '@core/cart/clear-cart-confirm';
import { ConfirmService } from '@core/confirm/confirm.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { SidebarService } from '../services/sidebar.service';
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
  readonly sidebar = inject(SidebarService);
  private readonly cartService = inject(CartService);
  private readonly confirm = inject(ConfirmService);

  // Sube cuando se rechaza un cambio, para que la barra vuelva a mostrar el titular anterior.
  readonly barResetKey = signal(0);

  readonly menu = MENU;
  readonly cart = CART;

  constructor() {
    this.viewing.load();
  }

  // Elección en la barra «Viendo» (HU-17). Con el carrito vacío o del mismo titular el cambio pasa sin
  // preguntar; con renglones de otro titular se pregunta antes, porque el carrito se vacía. Cancelar
  // no cambia nada y la barra vuelve al titular anterior. Nunca se vende del stock de otro titular.
  async onViewingChange(sellerId: string | null): Promise<void> {
    const cart = this.cartService;
    if (cart.lines().length === 0 || cart.holderId() === sellerId) {
      this.viewing.pick(sellerId);
      return;
    }
    const accepted = await this.confirm.ask(
      clearCartConfirmOptions(this.holderName(cart.holderId()), this.holderName(sellerId)),
    );
    if (!accepted) {
      this.barResetKey.update((key) => key + 1);
      return;
    }
    cart.clear();
    this.viewing.pick(sellerId);
  }

  private holderName(sellerId: string | null): string {
    if (sellerId === null) return WAREHOUSE_HOLDER_NAME;
    return this.viewing.sellers().find((seller) => seller.id === sellerId)?.fullName ?? UNKNOWN_HOLDER_NAME;
  }
}
