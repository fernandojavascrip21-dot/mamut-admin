import { CurrencyPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { unitsLabel } from '@shared/utils/units-label';
import { CART_BAR_TEXTS } from './cart-bar.constants';

// Barra del carrito (HU-15, movida a shared en HU-17): «Carrito · N piezas», el total y «Ver carrito».
// Solo presentación: la página decide cuándo se muestra (con piezas en el carrito), la deja fija
// abajo y le pasa a dónde lleva el enlace (`/vendedor/carrito` o `/admin/carrito`).
@Component({
  imports: [CurrencyPipe, RouterLink, ButtonDirective],
  selector: 'app-cart-bar',
  templateUrl: './cart-bar.component.html',
})
export class CartBarComponent {
  readonly texts = CART_BAR_TEXTS;
  readonly cartUrl = input.required<string>();

  readonly units = input.required<number>();
  // Monto con 2 decimales como texto (T-08).
  readonly total = input.required<string>();

  readonly summary = computed(() => `${this.texts.label}${this.texts.separator}${unitsLabel(this.units())}`);
  // Único `Number()` sobre un monto: solo para pasarlo al pipe `currency` al mostrarlo.
  readonly totalAmount = computed(() => Number(this.total()));
}
