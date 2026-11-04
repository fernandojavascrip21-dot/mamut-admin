import { CurrencyPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { unitsLabel } from '@shared/utils/units-label';
import { CART_BAR_TEXTS, CART_URL } from '../../constants/sell-page.constants';

// Barra del catálogo «Vender» (HU-15): «Carrito · N piezas», el total y «Ver carrito». Solo
// presentación: la página decide cuándo se muestra (con piezas en el carrito) y la deja fija abajo.
@Component({
  imports: [CurrencyPipe, RouterLink, ButtonDirective],
  selector: 'app-cart-bar',
  templateUrl: './cart-bar.component.html',
})
export class CartBarComponent {
  readonly texts = CART_BAR_TEXTS;
  readonly cartUrl = CART_URL;

  readonly units = input.required<number>();
  // Monto con 2 decimales como texto (T-08).
  readonly total = input.required<string>();

  readonly summary = computed(() => `${this.texts.label}${this.texts.separator}${unitsLabel(this.units())}`);
  // Único `Number()` sobre un monto: solo para pasarlo al pipe `currency` al mostrarlo.
  readonly totalAmount = computed(() => Number(this.total()));
}
