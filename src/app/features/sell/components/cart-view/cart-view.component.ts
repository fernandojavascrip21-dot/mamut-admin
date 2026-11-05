import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import type { CartConfirmError, CartPageState, CartPageTexts, CartRow } from '../../models/cart-page.models';
import { CartLineComponent } from '../cart-line/cart-line.component';
import { SellProductCardSkeletonComponent } from '../sell-product-card-skeleton/sell-product-card-skeleton.component';

// Cuerpo de «Carrito» compartido por el administrador y el vendedor (spec M3-hu15 y M3-hu17): el mismo
// orden y diseño para los dos. Solo presenta y emite; cada página decide de dónde salen los datos y qué
// regla de rol aplica: un dato que ese rol no debe ver (la ganancia, el titular) simplemente no llega,
// y aquí se oculta cuando es null, así el vendedor nunca ve costos ni ganancia.
@Component({
  imports: [CurrencyPipe, RouterLink, ButtonDirective, CartLineComponent, SellProductCardSkeletonComponent],
  selector: 'app-cart-view',
  templateUrl: './cart-view.component.html',
})
export class CartViewComponent {
  readonly texts = input.required<CartPageTexts>();
  readonly state = input.required<CartPageState>();
  readonly rows = input.required<CartRow[]>();
  readonly piecesLabel = input.required<string>();
  // Total a mostrar (el único Number() sobre un monto, hecho por la página).
  readonly totalAmount = input.required<number>();
  // null = no se muestra (vendedor).
  readonly profitAmount = input<number | null>(null);
  // «Vendiendo de: …»; null = no se muestra (vendedor).
  readonly holderName = input<string | null>(null);
  readonly keepSellingUrl = input.required<string>();
  readonly saving = input(false);
  readonly needsFix = input(false);
  readonly confirmError = input<CartConfirmError | null>(null);
  readonly invalidMessage = input('');

  readonly increment = output<CartRow>();
  readonly decrement = output<CartRow>();
  readonly remove = output<CartRow>();
  readonly retry = output<void>();
  readonly retrySend = output<void>();
  readonly confirm = output<void>();

  // Renglones que entran a la suma (los de más o agotados no cuentan): el resumen del panel muestra lo
  // mismo que suma el total.
  readonly summaryRows = computed(() => this.rows().filter((row) => row.status === 'ok'));

  // Subtotal de un renglón para el pipe `currency` (único `Number()` sobre un monto, junto a los totales).
  amountOf(row: CartRow): number {
    return Number(row.subtotal);
  }
}
